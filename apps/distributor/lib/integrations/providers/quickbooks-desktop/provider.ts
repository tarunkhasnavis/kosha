/**
 * QuickBooks Desktop - ErpProvider Implementation
 *
 * Implements the generic ErpProvider interface for QB Desktop via Conductor.
 * Same contract as QBO provider — swap is transparent to sync/UI code.
 */

import type { ErpProvider, ErpCustomer, ErpProduct, ErpSyncResult, ErpInvoiceStatusResult } from '../../types'
import type { Customer, Product, Order, OrderItem } from '@kosha/types'
import { createServiceClient } from '@kosha/supabase/service'
import {
  getCompanyInfo,
  listAllCustomers,
  createCustomer,
  updateCustomer,
  listAllInventoryItems,
  listAllServiceItems,
  listAllNonInventoryItems,
  createInvoice,
  getInvoice,
  isConductorError,
} from './client'
import {
  qbdCustomerToErp,
  koshaCustomerToQBDCreate,
  qbdInventoryItemToErp,
  qbdServiceItemToErp,
  qbdNonInventoryItemToErp,
  koshaOrderToQBDInvoice,
} from './mappers'

class QBDesktopProvider implements ErpProvider {
  type = 'quickbooks_desktop' as const
  private conductorEndUserId: string

  constructor(conductorEndUserId: string) {
    this.conductorEndUserId = conductorEndUserId
  }

  // ==========================================
  // Customers
  // ==========================================

  async pullCustomers(): Promise<ErpCustomer[]> {
    const customers = await listAllCustomers(this.conductorEndUserId)
    return customers.map(qbdCustomerToErp)
  }

  async pushCustomer(customer: Customer): Promise<ErpSyncResult> {
    try {
      if (customer.erp_entity_id) {
        // Update existing — need revisionNumber from metadata
        const revisionNumber = (customer.erp_metadata as Record<string, unknown>)?.revisionNumber as string || '0'
        const params = koshaCustomerToQBDCreate(customer)
        const updated = await updateCustomer(
          this.conductorEndUserId,
          customer.erp_entity_id,
          revisionNumber,
          params
        )
        return {
          success: true,
          erpEntityId: updated.id,
          erpDisplayName: updated.fullName,
        }
      } else {
        const params = koshaCustomerToQBDCreate(customer)
        const created = await createCustomer(this.conductorEndUserId, params)
        return {
          success: true,
          erpEntityId: created.id,
          erpDisplayName: created.fullName,
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to push customer to QuickBooks Desktop',
      }
    }
  }

  // ==========================================
  // Products
  // ==========================================

  async pullProducts(): Promise<ErpProduct[]> {
    // QBD has separate endpoints for each item type
    const [inventoryItems, serviceItems, nonInventoryItems] = await Promise.all([
      listAllInventoryItems(this.conductorEndUserId),
      listAllServiceItems(this.conductorEndUserId),
      listAllNonInventoryItems(this.conductorEndUserId),
    ])

    return [
      ...inventoryItems.map(qbdInventoryItemToErp),
      ...serviceItems.map(qbdServiceItemToErp),
      ...nonInventoryItems.map(qbdNonInventoryItemToErp),
    ]
  }

  async pushProduct(_product: Product): Promise<ErpSyncResult> {
    // QBD product creation requires knowing the item type and accounts
    // For now, we only support pulling products from QBD
    return {
      success: false,
      error: 'Pushing products to QuickBooks Desktop is not yet supported. Products should be created in QuickBooks Desktop and synced to Kosha.',
    }
  }

  // ==========================================
  // Invoices
  // ==========================================

  async pushInvoice(
    order: Order,
    items: OrderItem[],
    customer: Customer
  ): Promise<ErpSyncResult> {
    try {
      // Customer must be linked to QBD
      if (!customer.erp_entity_id) {
        return { success: false, error: 'Customer is not linked to QuickBooks Desktop. Sync the customer first.' }
      }

      // Resolve QBD item references for order items
      const itemRefs = await this.resolveItemRefs(items)

      const params = koshaOrderToQBDInvoice(order, items, customer.erp_entity_id, itemRefs)
      const invoice = await createInvoice(this.conductorEndUserId, params)

      return {
        success: true,
        erpEntityId: invoice.id,
        erpDisplayName: invoice.refNumber || `Invoice #${invoice.id}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to push invoice to QuickBooks Desktop',
      }
    }
  }

  async getInvoiceStatus(erpInvoiceId: string): Promise<ErpInvoiceStatusResult> {
    const invoice = await getInvoice(this.conductorEndUserId, erpInvoiceId)

    // QBD via Conductor provides isPaid boolean and balanceRemaining
    let status: ErpInvoiceStatusResult['status'] = 'unknown'
    const balanceRemaining = parseFloat(invoice.balanceRemaining || '0')
    const subtotal = parseFloat(invoice.subtotal || '0')

    if (invoice.isPaid) {
      status = 'paid'
    } else if (balanceRemaining > 0 && balanceRemaining < subtotal) {
      status = 'partially_paid'
    } else if (invoice.isPending) {
      status = 'draft'
    } else {
      status = 'sent'
    }

    return {
      status,
      amountDue: balanceRemaining,
      amountPaid: subtotal - balanceRemaining,
      dueDate: invoice.dueDate || null,
      raw: invoice as unknown as Record<string, unknown>,
    }
  }

  // ==========================================
  // Private helpers
  // ==========================================

  /**
   * Resolve QBD Item IDs for order items by looking up their
   * linked product's erp_entity_id in the Kosha DB.
   */
  private async resolveItemRefs(
    items: OrderItem[]
  ): Promise<Map<string, { qbdItemId: string; qbdItemName: string }>> {
    const itemRefs = new Map<string, { qbdItemId: string; qbdItemName: string }>()

    const skus = items.filter(i => i.sku && !i.deleted).map(i => i.sku!)
    if (skus.length === 0) return itemRefs

    const supabase = createServiceClient()
    const { data: products } = await supabase
      .from('products')
      .select('sku, erp_entity_id, erp_display_name, name')
      .in('sku', skus)
      .not('erp_entity_id', 'is', null)

    if (!products || products.length === 0) return itemRefs

    const skuToRef = new Map(
      products.map(p => [
        p.sku.toLowerCase(),
        { qbdItemId: p.erp_entity_id!, qbdItemName: p.erp_display_name || p.name },
      ])
    )

    for (const item of items) {
      if (item.sku) {
        const ref = skuToRef.get(item.sku.toLowerCase())
        if (ref) {
          itemRefs.set(item.id, ref)
        }
      }
    }

    return itemRefs
  }

  // ==========================================
  // Connection
  // ==========================================

  async testConnection(): Promise<{ success: boolean; companyName?: string; error?: string }> {
    try {
      const { companyName } = await getCompanyInfo(this.conductorEndUserId)
      return { success: true, companyName: companyName || undefined }
    } catch (error) {
      if (isConductorError(error)) {
        return { success: false, error: error.message }
      }
      return { success: false, error: 'Failed to connect to QuickBooks Desktop' }
    }
  }
}

/**
 * Factory function called by the registry.
 */
export async function createQBDesktopProvider(
  conductorEndUserId: string
): Promise<ErpProvider> {
  return new QBDesktopProvider(conductorEndUserId)
}
