/**
 * QuickBooks Online Webhook Handler
 *
 * Receives webhook notifications from Intuit when entities change in QBO.
 * This is QBO-specific (each ERP provider would have its own webhook endpoint),
 * but it calls the generic sync functions so all downstream logic is ERP-agnostic.
 *
 * QBO webhook flow:
 * 1. Entity changes in QBO (customer edited, invoice paid, etc.)
 * 2. Intuit sends POST to this endpoint with signed payload
 * 3. We verify the HMAC-SHA256 signature
 * 4. Respond 200 immediately (Intuit requires < 1s response)
 * 5. Process notifications asynchronously
 *
 * Intuit webhook payload format:
 * {
 *   "eventNotifications": [{
 *     "realmId": "123456",
 *     "dataChangeEvent": {
 *       "entities": [{
 *         "name": "Customer",
 *         "id": "56",
 *         "operation": "Update",
 *         "lastUpdated": "2025-01-01T00:00:00Z"
 *       }]
 *     }
 *   }]
 * }
 *
 * Signature verification:
 * - Header: `intuit-signature`
 * - Algorithm: HMAC-SHA256 using the webhook verifier token
 * - Payload: raw request body
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getOrganizationByRealmId } from '@/lib/integrations/providers/quickbooks-online/db'
import { pullCustomersFromErp } from '@/lib/integrations/sync/customers'
import { pullProductsFromErp } from '@/lib/integrations/sync/products'
import { pullInvoiceStatusFromErp } from '@/lib/integrations/sync/invoices'
import { createServiceClient } from '@kosha/supabase/service'

// ============================================
// Types
// ============================================

interface QBOWebhookPayload {
  eventNotifications: QBOEventNotification[]
}

interface QBOEventNotification {
  realmId: string
  dataChangeEvent: {
    entities: QBOEntityEvent[]
  }
}

interface QBOEntityEvent {
  name: string        // "Customer", "Item", "Invoice", "Payment"
  id: string          // Entity ID in QBO
  operation: string   // "Create", "Update", "Delete", "Merge", "Void"
  lastUpdated: string // ISO timestamp
}

// ============================================
// Signature verification
// ============================================

function verifySignature(rawBody: string, signature: string): boolean {
  const verifierToken = process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN
  if (!verifierToken) {
    console.error('QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN not configured')
    return false
  }

  const hash = crypto
    .createHmac('sha256', verifierToken)
    .update(rawBody)
    .digest('base64')

  return hash === signature
}

// ============================================
// POST handler
// ============================================

/**
 * POST /api/webhooks/quickbooks
 *
 * Intuit requires:
 * - 200 response within 1 second
 * - Respond to challenge requests (GET with challenge query param)
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Verify signature
  const signature = request.headers.get('intuit-signature')
  if (!signature || !verifySignature(rawBody, signature)) {
    console.error('QBO webhook: invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Parse payload
  let payload: QBOWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Respond immediately — Intuit requires fast response.
  // Process notifications async (fire and forget).
  processNotifications(payload.eventNotifications).catch(error => {
    console.error('QBO webhook processing error:', error)
  })

  return NextResponse.json({ status: 'ok' })
}

// ============================================
// Async processing
// ============================================

/**
 * Process webhook notifications asynchronously.
 * Groups events by realmId, then resolves the organization and dispatches
 * to the appropriate generic sync function.
 */
async function processNotifications(notifications: QBOEventNotification[]) {
  for (const notification of notifications) {
    const { realmId, dataChangeEvent } = notification

    // Resolve the organization from the realmId
    const organizationId = await getOrganizationByRealmId(realmId)
    if (!organizationId) {
      console.warn(`QBO webhook: no organization found for realmId ${realmId}`)
      continue
    }

    // Group entities by type for efficient processing
    const entityTypes = new Set(dataChangeEvent.entities.map(e => e.name))

    // Customer changes → pull all customers (bulk sync is simpler and handles
    // creates, updates, and deletes in one pass)
    if (entityTypes.has('Customer')) {
      try {
        const result = await pullCustomersFromErp(organizationId)
        console.log(`QBO webhook: customer sync for ${realmId} — created: ${result.created}, updated: ${result.updated}`)
        if (result.errors.length > 0) {
          console.error('QBO webhook: customer sync errors:', result.errors)
        }
      } catch (error) {
        console.error('QBO webhook: customer sync failed:', error)
      }
    }

    // Item changes → pull all products
    if (entityTypes.has('Item')) {
      try {
        const result = await pullProductsFromErp(organizationId)
        console.log(`QBO webhook: product sync for ${realmId} — created: ${result.created}, updated: ${result.updated}, pushed: ${result.pushed}`)
        if (result.errors.length > 0) {
          console.error('QBO webhook: product sync errors:', result.errors)
        }
      } catch (error) {
        console.error('QBO webhook: product sync failed:', error)
      }
    }

    // Invoice or Payment changes → check payment status for linked orders
    if (entityTypes.has('Invoice') || entityTypes.has('Payment')) {
      try {
        await syncInvoiceStatuses(organizationId, dataChangeEvent.entities)
      } catch (error) {
        console.error('QBO webhook: invoice status sync failed:', error)
      }
    }
  }
}

/**
 * For invoice/payment changes, find Kosha orders linked to the changed
 * QBO invoices and check their payment status.
 */
async function syncInvoiceStatuses(
  organizationId: string,
  entities: QBOEntityEvent[]
) {
  const supabase = createServiceClient()

  // Collect QBO entity IDs for invoices and payments
  const invoiceIds = entities
    .filter(e => e.name === 'Invoice')
    .map(e => e.id)

  // For payment events, we don't know which invoice they apply to,
  // so we check all invoiced orders for the org
  const hasPaymentEvents = entities.some(e => e.name === 'Payment')

  if (invoiceIds.length > 0) {
    // Find orders linked to these specific QBO invoices
    const { data: orders } = await supabase
      .from('orders')
      .select('id, erp_entity_id')
      .eq('organization_id', organizationId)
      .in('erp_entity_id', invoiceIds)
      .in('status', ['invoiced', 'approved'])

    if (orders) {
      for (const order of orders) {
        try {
          const result = await pullInvoiceStatusFromErp(organizationId, order.id)
          if (result.success) {
            console.log(`QBO webhook: invoice ${order.erp_entity_id} status updated for order ${order.id}`)
          }
        } catch (error) {
          console.error(`QBO webhook: failed to check invoice status for order ${order.id}:`, error)
        }
      }
    }
  }

  if (hasPaymentEvents) {
    // Payment events don't tell us which invoice, so check all invoiced orders
    const { data: invoicedOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('status', 'invoiced')
      .not('erp_entity_id', 'is', null)

    if (invoicedOrders) {
      for (const order of invoicedOrders) {
        try {
          await pullInvoiceStatusFromErp(organizationId, order.id)
        } catch (error) {
          console.error(`QBO webhook: failed to check payment status for order ${order.id}:`, error)
        }
      }
    }
  }
}
