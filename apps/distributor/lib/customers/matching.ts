/**
 * Customer Matching Logic
 *
 * Matches incoming order data to existing customers.
 * Used by email processing pipeline to suggest customer matches.
 *
 * KEY PRINCIPLE: AI proposes, human confirms.
 * This module ONLY populates suggested_customer_id - never customer_id.
 * The FK (customer_id) is only set after human confirmation in the UI.
 */

import { getCustomersForMatching, getCustomerByEmail, getCustomerByName } from './queries'
import {
  findCustomerMatches,
  normalizeCompanyName,
  calculateStringSimilarity,
  isConfidentMatch,
} from './services'
import type { Customer, CustomerMatch } from '@kosha/types'

/**
 * Result of customer matching during order creation
 */
export interface CustomerMatchResult {
  /** Best matching customer (if found) */
  suggestedCustomer: Customer | null
  /** Confidence score (0-1) */
  confidence: number
  /** Type of match found */
  matchType: 'exact_email' | 'exact_name' | 'fuzzy_name' | null
  /** All candidate matches for UI display */
  allMatches: CustomerMatch[]
}

/**
 * Match an incoming order to existing customers
 *
 * This is called during email processing after AI extraction.
 * Returns a suggestion that will be stored in suggested_customer_id.
 *
 * Priority order:
 * 1. Exact email match (highest confidence)
 * 2. Exact name match (high confidence)
 * 3. Fuzzy name match (variable confidence based on similarity)
 *
 * @param companyName - Company name extracted from email
 * @param contactEmail - Contact email extracted from email (optional)
 * @returns CustomerMatchResult with suggestion and confidence
 */
export async function matchCustomerForOrder(
  companyName: string,
  contactEmail: string | null
): Promise<CustomerMatchResult> {
  // Default result - no match
  const noMatch: CustomerMatchResult = {
    suggestedCustomer: null,
    confidence: 0,
    matchType: null,
    allMatches: [],
  }

  if (!companyName.trim()) {
    return noMatch
  }

  // Try exact email match first (if email provided)
  if (contactEmail) {
    const customerByEmail = await getCustomerByEmail(contactEmail)
    if (customerByEmail) {
      return {
        suggestedCustomer: customerByEmail,
        confidence: 1.0,
        matchType: 'exact_email',
        allMatches: [{
          customer: customerByEmail,
          confidence: 1.0,
          matchType: 'exact_email',
        }],
      }
    }
  }

  // Try exact name match
  const customerByName = await getCustomerByName(companyName)
  if (customerByName) {
    return {
      suggestedCustomer: customerByName,
      confidence: 0.95,
      matchType: 'exact_name',
      allMatches: [{
        customer: customerByName,
        confidence: 0.95,
        matchType: 'exact_name',
      }],
    }
  }

  // Fuzzy name matching against all active customers
  const allCustomers = await getCustomersForMatching()

  if (allCustomers.length === 0) {
    return noMatch
  }

  const matches = findCustomerMatches(companyName, contactEmail, allCustomers, {
    minSimilarity: 0.7,
    maxResults: 5,
  })

  if (matches.length === 0) {
    return noMatch
  }

  const bestMatch = matches[0]

  // Only suggest if confidence is high enough
  if (isConfidentMatch(bestMatch, 0.85)) {
    return {
      suggestedCustomer: bestMatch.customer,
      confidence: bestMatch.confidence,
      matchType: bestMatch.matchType,
      allMatches: matches,
    }
  }

  // Return all matches but no suggestion (user must choose)
  return {
    suggestedCustomer: null,
    confidence: 0,
    matchType: null,
    allMatches: matches,
  }
}

/**
 * Find similar customers for duplicate detection
 *
 * Used when creating a new customer to warn about potential duplicates.
 *
 * @param name - Name of the customer being created
 * @param threshold - Minimum similarity score (default: 0.8)
 * @returns Array of similar customers with similarity scores
 */
export async function findSimilarCustomers(
  name: string,
  threshold: number = 0.8
): Promise<Array<{ customer: Customer; similarity: number }>> {
  const allCustomers = await getCustomersForMatching()

  if (allCustomers.length === 0) {
    return []
  }

  const normalizedName = normalizeCompanyName(name)
  const similar: Array<{ customer: Customer; similarity: number }> = []

  for (const customer of allCustomers) {
    const normalizedCustomerName = normalizeCompanyName(customer.name)
    const similarity = calculateStringSimilarity(normalizedName, normalizedCustomerName)

    if (similarity >= threshold && similarity < 1.0) {
      similar.push({
        customer: customer as Customer,
        similarity,
      })
    }
  }

  return similar.sort((a, b) => b.similarity - a.similarity)
}

/**
 * Get match explanation for UI display
 *
 * Provides a human-readable explanation of why a customer was suggested.
 */
export function getMatchExplanation(matchType: CustomerMatch['matchType'], confidence: number): string {
  switch (matchType) {
    case 'exact_email':
      return 'Email address matches exactly'
    case 'exact_name':
      return 'Company name matches exactly'
    case 'fuzzy_name':
      const percent = Math.round(confidence * 100)
      return `Company name is ${percent}% similar`
    default:
      return 'No match found'
  }
}

/**
 * Check if customer confirmation is required before order approval
 *
 * Returns true if the order has no confirmed customer_id,
 * meaning the user must select/confirm a customer before approving.
 */
export function requiresCustomerConfirmation(order: {
  customer_id: string | null
  status: string
}): boolean {
  // Customer is required for approval
  if (order.status === 'waiting_review' && !order.customer_id) {
    return true
  }
  return false
}
