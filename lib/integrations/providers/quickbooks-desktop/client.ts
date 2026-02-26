/**
 * QuickBooks Desktop - Conductor SDK Client
 *
 * Thin wrapper around the conductor-node SDK.
 * Provides a singleton Conductor client instance and
 * typed helpers for QBD operations.
 *
 * All QBD API calls require a conductorEndUserId to identify
 * which QB Desktop company file to route the request to.
 */

import Conductor from 'conductor-node'

// ============================================
// Singleton client
// ============================================

let _client: Conductor | null = null

function getConductorClient(): Conductor {
  if (_client) return _client

  const apiKey = process.env.CONDUCTOR_SECRET_KEY
  if (!apiKey) throw new Error('CONDUCTOR_SECRET_KEY is not set')

  _client = new Conductor({ apiKey })
  return _client
}

// ============================================
// End Users & Auth Sessions
// ============================================

export async function createEndUser(
  sourceId: string,
  companyName: string,
  email: string
): Promise<{ id: string }> {
  const client = getConductorClient()
  const endUser = await client.endUsers.create({
    sourceId,
    companyName,
    email,
  })
  return { id: endUser.id }
}

export async function createAuthSession(
  endUserId: string,
  redirectUrl: string
): Promise<{ authFlowUrl: string }> {
  const publishableKey = process.env.CONDUCTOR_PUBLISHABLE_KEY
  if (!publishableKey) throw new Error('CONDUCTOR_PUBLISHABLE_KEY is not set')

  const client = getConductorClient()
  const session = await client.authSessions.create({
    publishableKey,
    endUserId,
    linkExpiryMins: 1440, // 24 hours
    redirectUrl,
  })

  return { authFlowUrl: session.authFlowUrl }
}

// ============================================
// Company
// ============================================

export async function getCompanyInfo(
  conductorEndUserId: string
): Promise<{ companyName: string | null }> {
  const client = getConductorClient()
  const company = await client.qbd.company.retrieve({ conductorEndUserId })
  return { companyName: company.companyName }
}

// ============================================
// Customers
// ============================================

export async function listAllCustomers(
  conductorEndUserId: string
) {
  const client = getConductorClient()
  const customers = []

  for await (const customer of client.qbd.customers.list({
    conductorEndUserId,
    status: 'active',
  })) {
    customers.push(customer)
  }

  return customers
}

export async function createCustomer(
  conductorEndUserId: string,
  params: {
    name: string
    companyName?: string
    email?: string
    phone?: string
    firstName?: string
    lastName?: string
    billingAddress?: {
      line1?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
    }
  }
) {
  const client = getConductorClient()
  return client.qbd.customers.create({
    conductorEndUserId,
    name: params.name,
    companyName: params.companyName,
    email: params.email,
    phone: params.phone,
    firstName: params.firstName,
    lastName: params.lastName,
    billingAddress: params.billingAddress,
  })
}

export async function updateCustomer(
  conductorEndUserId: string,
  customerId: string,
  revisionNumber: string,
  params: {
    name?: string
    companyName?: string
    email?: string
    phone?: string
    firstName?: string
    lastName?: string
    billingAddress?: {
      line1?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
    }
  }
) {
  const client = getConductorClient()
  return client.qbd.customers.update(customerId, {
    conductorEndUserId,
    revisionNumber,
    ...params,
  })
}

// ============================================
// Items (Inventory + Service + Non-Inventory)
// ============================================

export async function listAllInventoryItems(
  conductorEndUserId: string
) {
  const client = getConductorClient()
  const items = []

  for await (const item of client.qbd.inventoryItems.list({
    conductorEndUserId,
    status: 'active',
  })) {
    items.push(item)
  }

  return items
}

export async function listAllServiceItems(
  conductorEndUserId: string
) {
  const client = getConductorClient()
  const items = []

  for await (const item of client.qbd.serviceItems.list({
    conductorEndUserId,
    status: 'active',
  })) {
    items.push(item)
  }

  return items
}

export async function listAllNonInventoryItems(
  conductorEndUserId: string
) {
  const client = getConductorClient()
  const items = []

  for await (const item of client.qbd.nonInventoryItems.list({
    conductorEndUserId,
    status: 'active',
  })) {
    items.push(item)
  }

  return items
}

// ============================================
// Invoices
// ============================================

export async function createInvoice(
  conductorEndUserId: string,
  params: {
    customerId: string
    transactionDate: string
    refNumber?: string
    dueDate?: string
    memo?: string
    lines: Array<{
      itemId?: string
      description?: string
      quantity?: number
      rate?: string
    }>
  }
) {
  const client = getConductorClient()
  return client.qbd.invoices.create({
    conductorEndUserId,
    customerId: params.customerId,
    transactionDate: params.transactionDate,
    refNumber: params.refNumber,
    dueDate: params.dueDate,
    memo: params.memo,
    lines: params.lines,
  })
}

export async function getInvoice(
  conductorEndUserId: string,
  invoiceId: string
) {
  const client = getConductorClient()
  return client.qbd.invoices.retrieve(invoiceId, { conductorEndUserId })
}

// ============================================
// Error helpers
// ============================================

export function isConductorError(error: unknown): error is InstanceType<typeof Conductor.APIError> {
  return error instanceof Conductor.APIError
}

export function isConnectionNotSetUp(error: unknown): boolean {
  if (!isConductorError(error)) return false
  return error.message?.includes('INTEGRATION_CONNECTION_NOT_SET_UP') ?? false
}
