/**
 * QuickBooks Online - REST API Client
 *
 * Low-level HTTP client for the QBO API. Handles auth headers,
 * base URL, and auto-retry on 401 (token refresh).
 *
 * All QBO API calls go through qboFetch().
 */

import { getValidAccessToken, getQBOBaseUrl } from './auth'
import type { QBOCustomer, QBOItem, QBOInvoice } from './types'

// ============================================
// Base fetch helper
// ============================================

/**
 * Authenticated fetch to the QBO API.
 * Auto-refreshes the token on 401 and retries once.
 */
export async function qboFetch(
  organizationId: string,
  realmId: string,
  method: 'GET' | 'POST',
  endpoint: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const accessToken = await getValidAccessToken(organizationId)
  const baseUrl = getQBOBaseUrl()
  const url = `${baseUrl}/v3/company/${realmId}${endpoint}`

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  // Auto-retry once on 401 (token may have expired between check and call)
  if (response.status === 401) {
    const freshToken = await getValidAccessToken(organizationId)
    return fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${freshToken}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  }

  return response
}

// ============================================
// Customer endpoints
// ============================================

/**
 * Query all active customers from QBO.
 * Uses the QBO Query API with pagination.
 */
export async function queryCustomers(
  organizationId: string,
  realmId: string
): Promise<QBOCustomer[]> {
  const allCustomers: QBOCustomer[] = []
  let startPosition = 1
  const maxResults = 100

  while (true) {
    const query = `SELECT * FROM Customer WHERE Active = true STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    const response = await qboFetch(
      organizationId,
      realmId,
      'GET',
      `/query?query=${encodeURIComponent(query)}`
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`QBO customer query failed (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const customers = data.QueryResponse?.Customer || []
    allCustomers.push(...customers)

    // If we got fewer than maxResults, we've fetched everything
    if (customers.length < maxResults) break
    startPosition += maxResults
  }

  return allCustomers
}

/**
 * Create a customer in QBO.
 */
export async function createQBOCustomer(
  organizationId: string,
  realmId: string,
  payload: Record<string, unknown>
): Promise<QBOCustomer> {
  const response = await qboFetch(
    organizationId,
    realmId,
    'POST',
    '/customer',
    payload
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`QBO customer create failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data.Customer
}

/**
 * Update a customer in QBO.
 * Requires Id and SyncToken (optimistic locking).
 */
export async function updateQBOCustomer(
  organizationId: string,
  realmId: string,
  payload: Record<string, unknown>
): Promise<QBOCustomer> {
  const response = await qboFetch(
    organizationId,
    realmId,
    'POST',
    '/customer',
    payload
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`QBO customer update failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data.Customer
}

// ============================================
// Item/Product endpoints
// ============================================

/**
 * Query all active items from QBO.
 * Filters to Inventory, NonInventory, and Service types (skips Category/Group).
 */
export async function queryItems(
  organizationId: string,
  realmId: string
): Promise<QBOItem[]> {
  const allItems: QBOItem[] = []
  let startPosition = 1
  const maxResults = 100

  while (true) {
    const query = `SELECT * FROM Item WHERE Active = true AND Type IN ('Inventory', 'NonInventory', 'Service') STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    const response = await qboFetch(
      organizationId,
      realmId,
      'GET',
      `/query?query=${encodeURIComponent(query)}`
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`QBO item query failed (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    const items = data.QueryResponse?.Item || []
    allItems.push(...items)

    if (items.length < maxResults) break
    startPosition += maxResults
  }

  return allItems
}

/**
 * Create an item in QBO.
 */
export async function createQBOItem(
  organizationId: string,
  realmId: string,
  payload: Record<string, unknown>
): Promise<QBOItem> {
  const response = await qboFetch(
    organizationId,
    realmId,
    'POST',
    '/item',
    payload
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`QBO item create failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data.Item
}

/**
 * Query the default Sales/Income account from QBO.
 * QBO requires an IncomeAccountRef when creating NonInventory/Service items.
 * Returns the first "Income" account found.
 */
export async function getIncomeAccountId(
  organizationId: string,
  realmId: string
): Promise<string> {
  const query = `SELECT Id FROM Account WHERE AccountType = 'Income' MAXRESULTS 1`
  const response = await qboFetch(
    organizationId,
    realmId,
    'GET',
    `/query?query=${encodeURIComponent(query)}`
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`QBO account query failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const accounts = data.QueryResponse?.Account || []
  if (accounts.length === 0) {
    throw new Error('No income account found in QBO. Create one first.')
  }

  return accounts[0].Id
}

// ============================================
// Invoice endpoints
// ============================================

/**
 * Create an invoice in QBO.
 */
export async function createQBOInvoice(
  organizationId: string,
  realmId: string,
  payload: Record<string, unknown>
): Promise<QBOInvoice> {
  const response = await qboFetch(
    organizationId,
    realmId,
    'POST',
    '/invoice',
    payload
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`QBO invoice create failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data.Invoice
}

/**
 * Get a single invoice from QBO by ID.
 */
export async function getQBOInvoice(
  organizationId: string,
  realmId: string,
  invoiceId: string
): Promise<QBOInvoice> {
  const response = await qboFetch(
    organizationId,
    realmId,
    'GET',
    `/invoice/${invoiceId}`
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`QBO invoice fetch failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data.Invoice
}
