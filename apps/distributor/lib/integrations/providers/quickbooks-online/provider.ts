/**
 * QuickBooks Online - ErpProvider Implementation
 *
 * Implements the generic ErpProvider interface for QBO.
 * Methods are stubbed initially and fleshed out in Phases 2-4.
 */

import type { ErpProvider, ErpCustomer, ErpProduct, ErpSyncResult, ErpInvoiceStatusResult } from '../../types'
import type { Customer, Order, OrderItem, Product } from '@kosha/types'
import { getValidAccessToken, getQBOBaseUrl } from './auth'
import { getQBOSettings } from './db'
import { createServiceClient } from '@kosha/supabase/service'
import { queryCustomers, createQBOCustomer, updateQBOCustomer, queryItems, createQBOItem, getIncomeAccountId, createQBOInvoice, getQBOInvoice } from './client'
import { qboCustomerToErp, koshaCustomerToQBOCreate, koshaCustomerToQBOUpdate, qboItemToErp, koshaProductToQBOCreate, koshaOrderToQBOInvoice } from './mappers'

class QBOProvider implements ErpProvider {
  type = 'quickbooks_online' as const
  private organizationId: string
  private realmId: string

  constructor(organizationId: string, realmId: string) {
    this.organizationId = organizationId
    this.realmId = realmId
  }

  // ==========================================
  // Customers (Phase 2)
  // ==========================================

  async pullCustomers(): Promise<ErpCustomer[]> {
    const qboCustomers = await queryCustomers(this.organizationId, this.realmId)
    return qboCustomers.map(qboCustomerToErp)
  }

  async pushCustomer(customer: Customer): Promise<ErpSyncResult> {
    try {
      // If customer already has a QBO ID, update; otherwise create
      if (customer.erp_entity_id) {
        // Need the SyncToken from the raw metadata
        const syncToken = (customer.erp_metadata as Record<string, unknown>)?.SyncToken as string || '0'
        const payload = koshaCustomerToQBOUpdate(customer, customer.erp_entity_id, syncToken)
        const updated = await updateQBOCustomer(this.organizationId, this.realmId, payload)
        return {
          success: true,
          erpEntityId: updated.Id,
          erpDisplayName: updated.DisplayName,
        }
      } else {
        const payload = koshaCustomerToQBOCreate(customer)
        const created = await createQBOCustomer(this.organizationId, this.realmId, payload)
        return {
          success: true,
          erpEntityId: created.Id,
          erpDisplayName: created.DisplayName,
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to push customer to QBO',
      }
    }
  }

  // ==========================================
  // Products (Phase 3)
  // ==========================================

  async pullProducts(): Promise<ErpProduct[]> {
    const qboItems = await queryItems(this.organizationId, this.realmId)
    return qboItems.map(qboItemToErp)
  }

  async pushProduct(product: Product): Promise<ErpSyncResult> {
    try {
      // QBO requires an IncomeAccountRef for NonInventory/Service items
      const incomeAccountId = await getIncomeAccountId(this.organizationId, this.realmId)
      const payload = koshaProductToQBOCreate(product, incomeAccountId)
      const created = await createQBOItem(this.organizationId, this.realmId, payload)
      return {
        success: true,
        erpEntityId: created.Id,
        erpDisplayName: created.Name,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to push product to QBO',
      }
    }
  }

  // ==========================================
  // Invoices (Phase 4)
  // ==========================================

  async pushInvoice(
    order: Order,
    items: OrderItem[],
    customer: Customer
  ): Promise<ErpSyncResult> {
    try {
      // Customer must be linked to QBO
      if (!customer.erp_entity_id) {
        return { success: false, error: 'Customer is not linked to QuickBooks. Sync the customer first.' }
      }

      // Resolve QBO Item references for order items by matching erp_entity_id on products
      const itemRefs = await this.resolveItemRefs(items)

      const payload = koshaOrderToQBOInvoice(order, items, customer.erp_entity_id, itemRefs)
      const invoice = await createQBOInvoice(this.organizationId, this.realmId, payload)

      return {
        success: true,
        erpEntityId: invoice.Id,
        erpDisplayName: invoice.DocNumber || `Invoice #${invoice.Id}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to push invoice to QBO',
      }
    }
  }

  async getInvoiceStatus(erpInvoiceId: string): Promise<ErpInvoiceStatusResult> {
    const invoice = await getQBOInvoice(this.organizationId, this.realmId, erpInvoiceId)

    // QBO: Balance = 0 means fully paid, Balance = TotalAmt means unpaid
    let status: ErpInvoiceStatusResult['status'] = 'unknown'
    if (invoice.Balance === 0 && invoice.TotalAmt > 0) {
      status = 'paid'
    } else if (invoice.Balance < invoice.TotalAmt) {
      status = 'partially_paid'
    } else {
      status = 'sent' // QBO invoices are "sent" once created
    }

    return {
      status,
      amountDue: invoice.Balance,
      amountPaid: invoice.TotalAmt - invoice.Balance,
      dueDate: invoice.DueDate || null,
      raw: invoice as unknown as Record<string, unknown>,
    }
  }

  // ==========================================
  // Private helpers
  // ==========================================

  /**
   * Resolve QBO Item IDs for order items by looking up their
   * linked product's erp_entity_id in the Kosha DB.
   */
  private async resolveItemRefs(
    items: OrderItem[]
  ): Promise<Map<string, { qboItemId: string; qboItemName: string }>> {
    const itemRefs = new Map<string, { qboItemId: string; qboItemName: string }>()

    // Get SKUs from order items to find matching products
    const skus = items.filter(i => i.sku && !i.deleted).map(i => i.sku!)
    if (skus.length === 0) return itemRefs

    const supabase = createServiceClient()
    const { data: products } = await supabase
      .from('products')
      .select('sku, erp_entity_id, erp_display_name, name')
      .in('sku', skus)
      .not('erp_entity_id', 'is', null)

    if (!products || products.length === 0) return itemRefs

    // Build SKU -> QBO Item ref lookup
    const skuToRef = new Map(
      products.map(p => [
        p.sku.toLowerCase(),
        { qboItemId: p.erp_entity_id!, qboItemName: p.erp_display_name || p.name },
      ])
    )

    // Map order items to their QBO Item refs
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
      const accessToken = await getValidAccessToken(this.organizationId)
      const baseUrl = getQBOBaseUrl()

      const response = await fetch(
        `${baseUrl}/v3/company/${this.realmId}/companyinfo/${this.realmId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      )

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Authentication expired. Please reconnect.' }
        }
        return { success: false, error: `Connection failed: ${response.status}` }
      }

      const data = await response.json()
      const companyName = data.CompanyInfo?.CompanyName

      return { success: true, companyName }
    } catch (error) {
      console.error('QBO connection test failed:', error)
      return { success: false, error: 'Failed to connect to QuickBooks' }
    }
  }
}

/**
 * Factory function called by the registry.
 */
export async function createQBOProvider(organizationId: string): Promise<ErpProvider | null> {
  const settings = await getQBOSettings(organizationId)
  if (!settings) return null

  return new QBOProvider(organizationId, settings.config.realmId)
}
