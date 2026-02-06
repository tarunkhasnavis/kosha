/**
 * Customer Services
 *
 * Business logic and helper operations for customers.
 * Pure functions where possible - no server actions here.
 */

import type { Customer, CustomerMatch } from '@/types/customers'

/**
 * Calculate similarity score between two strings using Levenshtein distance
 * Returns a value between 0 (completely different) and 1 (identical)
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0

  const matrix: number[][] = []

  // Initialize matrix
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j
  }

  // Fill matrix
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  const maxLength = Math.max(s1.length, s2.length)
  const distance = matrix[s1.length][s2.length]
  return 1 - distance / maxLength
}

/**
 * Normalize a company name for comparison
 * Removes common suffixes, punctuation, and normalizes spacing
 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Remove common company suffixes
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co|llp|pllc|pc|pa|na)\b\.?$/gi, '')
    // Remove punctuation
    .replace(/[.,\-_&]/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Check if two email addresses match (case-insensitive, ignoring + aliases)
 */
export function emailsMatch(email1: string | null, email2: string | null): boolean {
  if (!email1 || !email2) return false

  const normalize = (email: string) => {
    const lower = email.toLowerCase().trim()
    // Remove + alias (e.g., john+orders@example.com -> john@example.com)
    return lower.replace(/\+[^@]*@/, '@')
  }

  return normalize(email1) === normalize(email2)
}

/**
 * Extract the domain from an email address
 */
export function extractEmailDomain(email: string): string | null {
  const match = email.match(/@([^@\s]+)$/)
  return match ? match[1].toLowerCase() : null
}

/**
 * Find potential customer matches from a list of customers
 * Returns matches sorted by confidence (highest first)
 */
export function findCustomerMatches(
  searchName: string,
  searchEmail: string | null,
  customers: Array<{
    id: string
    name: string
    primary_contact_email: string | null
  }>,
  options: {
    minSimilarity?: number
    maxResults?: number
  } = {}
): CustomerMatch[] {
  const { minSimilarity = 0.7, maxResults = 5 } = options
  const matches: CustomerMatch[] = []
  const normalizedSearchName = normalizeCompanyName(searchName)

  for (const customer of customers) {
    // Check for exact email match first (highest priority)
    if (searchEmail && emailsMatch(searchEmail, customer.primary_contact_email)) {
      matches.push({
        customer: customer as Customer,
        confidence: 1.0,
        matchType: 'exact_email',
      })
      continue
    }

    // Check for exact name match
    const normalizedCustomerName = normalizeCompanyName(customer.name)
    if (normalizedSearchName === normalizedCustomerName) {
      matches.push({
        customer: customer as Customer,
        confidence: 0.95,
        matchType: 'exact_name',
      })
      continue
    }

    // Check for fuzzy name match
    const similarity = calculateStringSimilarity(normalizedSearchName, normalizedCustomerName)
    if (similarity >= minSimilarity) {
      matches.push({
        customer: customer as Customer,
        confidence: similarity,
        matchType: 'fuzzy_name',
      })
    }
  }

  // Sort by confidence (highest first) and limit results
  return matches
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxResults)
}

/**
 * Determine if a match is confident enough to auto-suggest
 * Returns true if the match should be shown to the user as a suggestion
 */
export function isConfidentMatch(match: CustomerMatch, threshold: number = 0.85): boolean {
  return match.confidence >= threshold
}

/**
 * Format a customer's display name for UI
 * Includes customer number if available
 */
export function formatCustomerDisplayName(customer: Customer): string {
  if (customer.customer_number) {
    return `${customer.name} (${customer.customer_number})`
  }
  return customer.name
}

/**
 * Format a currency value for display
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Format a date for display
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateString))
}

/**
 * Get the ERP sync status display text and color
 */
export function getErpSyncStatusDisplay(
  status: Customer['erp_sync_status']
): { text: string; color: 'gray' | 'green' | 'yellow' | 'red' } {
  switch (status) {
    case 'synced':
      return { text: 'Synced', color: 'green' }
    case 'pending':
      return { text: 'Pending', color: 'yellow' }
    case 'conflict':
      return { text: 'Conflict', color: 'yellow' }
    case 'error':
      return { text: 'Error', color: 'red' }
    default:
      return { text: 'Not linked', color: 'gray' }
  }
}

/**
 * Validate a customer name
 * Returns an error message if invalid, or null if valid
 */
export function validateCustomerName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) {
    return 'Customer name is required'
  }
  if (trimmed.length < 2) {
    return 'Customer name must be at least 2 characters'
  }
  if (trimmed.length > 255) {
    return 'Customer name must be less than 255 characters'
  }
  return null
}

/**
 * Validate an email address
 * Returns an error message if invalid, or null if valid
 */
export function validateEmail(email: string): string | null {
  if (!email.trim()) {
    return null // Email is optional
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim())) {
    return 'Invalid email address'
  }
  return null
}

/**
 * Validate a phone number (basic validation)
 * Returns an error message if invalid, or null if valid
 */
export function validatePhone(phone: string): string | null {
  if (!phone.trim()) {
    return null // Phone is optional
  }
  // Allow common formats: (555) 123-4567, 555-123-4567, 5551234567, +1-555-123-4567
  const phoneRegex = /^[+]?[\d\s\-().]{10,20}$/
  if (!phoneRegex.test(phone.trim())) {
    return 'Invalid phone number'
  }
  return null
}
