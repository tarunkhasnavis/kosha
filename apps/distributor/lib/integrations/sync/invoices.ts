/**
 * Invoice Sync Orchestration (ERP-agnostic)
 *
 * Handles pushing invoices to the ERP and pulling invoice status back.
 * The provider-specific API calls are abstracted behind ErpProvider.
 *
 * Flow:
 * 1. Order approved -> pushInvoiceToErp() -> creates invoice in ERP
 * 2. Order transitions to 'invoiced'
 * 3. Periodic or webhook-driven -> pullInvoiceStatusFromErp() -> checks payment
 * 4. If paid, order transitions to 'paid'
 */

import { createServiceClient } from '@kosha/supabase/service'
import { getErpProvider } from '../registry'
import type { Customer, Order, OrderItem } from '@kosha/types'

/**
 * Push an invoice to the ERP for a given order.
 *
 * Prerequisites:
 * - Order must have a customer_id (linked customer)
 * - Customer must have erp_entity_id (synced to ERP)
 *
 * On success: updates order erp_* fields + transitions status to 'invoiced'
 */
export async function pushInvoiceToErp(
  organizationId: string,
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const provider = await getErpProvider(organizationId)
  if (!provider) {
    return { success: false, error: 'No ERP provider configured' }
  }

  const supabase = createServiceClient()

  // Load the order with items
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .single()

  if (orderError || !order) {
    return { success: false, error: 'Order not found' }
  }

  // Order must have a linked customer
  if (!order.customer_id) {
    return { success: false, error: 'Order has no linked customer. Link a customer first.' }
  }

  // Already invoiced in ERP?
  if (order.erp_entity_id) {
    return { success: false, error: 'Order already has an ERP invoice' }
  }

  // Load the customer
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', order.customer_id)
    .single()

  if (customerError || !customer) {
    return { success: false, error: 'Customer not found' }
  }

  // Load order items
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .eq('deleted', false)

  if (itemsError) {
    return { success: false, error: 'Failed to load order items' }
  }

  // Mark as pending
  await supabase
    .from('orders')
    .update({ erp_sync_status: 'pending' })
    .eq('id', orderId)

  // Push to ERP
  const result = await provider.pushInvoice(
    order as Order,
    (items || []) as OrderItem[],
    customer as Customer
  )

  if (result.success) {
    // Update order with ERP reference and transition to invoiced
    await supabase
      .from('orders')
      .update({
        erp_entity_id: result.erpEntityId,
        erp_display_name: result.erpDisplayName,
        erp_synced_at: new Date().toISOString(),
        erp_sync_status: 'synced',
        erp_sync_error: null,
        status: 'invoiced',
      })
      .eq('id', orderId)

    return { success: true }
  } else {
    await supabase
      .from('orders')
      .update({
        erp_sync_status: 'error',
        erp_sync_error: result.error || 'Invoice push failed',
      })
      .eq('id', orderId)

    return { success: false, error: result.error }
  }
}

/**
 * Pull invoice status from the ERP for a given order.
 *
 * If the invoice is fully paid, transitions the order to 'paid'.
 */
export async function pullInvoiceStatusFromErp(
  organizationId: string,
  orderId: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  const provider = await getErpProvider(organizationId)
  if (!provider) {
    return { success: false, error: 'No ERP provider configured' }
  }

  const supabase = createServiceClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('erp_entity_id, status')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .single()

  if (orderError || !order) {
    return { success: false, error: 'Order not found' }
  }

  if (!order.erp_entity_id) {
    return { success: false, error: 'Order has no ERP invoice' }
  }

  const statusResult = await provider.getInvoiceStatus(order.erp_entity_id)

  // Update metadata
  await supabase
    .from('orders')
    .update({
      erp_metadata: statusResult.raw,
      erp_synced_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  // Auto-transition to paid if invoice is fully paid
  if (statusResult.status === 'paid' && order.status === 'invoiced') {
    await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', orderId)
  }

  return { success: true, status: statusResult.status }
}
