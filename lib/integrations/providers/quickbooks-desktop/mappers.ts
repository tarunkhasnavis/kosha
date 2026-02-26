/**
 * QuickBooks Desktop - Data Mappers
 *
 * Pure transform functions between Kosha data and Conductor SDK response types.
 * No side effects, no API calls, no DB access.
 *
 * Uses the conductor-node SDK types directly for input;
 * transforms to the generic ErpCustomer/ErpProduct types from lib/integrations/types.ts.
 */

import type { ErpCustomer, ErpProduct } from '../../types'
import type { Customer } from '@/types/customers'
import type { Order, OrderItem } from '@/types/orders'
import type { Qbd } from 'conductor-node/resources'

// ============================================
// QBD Customer -> Generic ErpCustomer
// ============================================

export function qbdCustomerToErp(customer: Qbd.Customer): ErpCustomer {
  return {
    erpId: customer.id,
    displayName: customer.fullName,
    email: customer.email || null,
    phone: customer.phone || null,
    companyName: customer.companyName || null,
    billingAddress: customer.billingAddress
      ? {
          street: customer.billingAddress.line1 || undefined,
          city: customer.billingAddress.city || undefined,
          state: customer.billingAddress.state || undefined,
          zip: customer.billingAddress.postalCode || undefined,
          country: customer.billingAddress.country || undefined,
        }
      : null,
    raw: customer as unknown as Record<string, unknown>,
  }
}

// ============================================
// Kosha Customer -> QBD create params
// ============================================

export function koshaCustomerToQBDCreate(customer: Customer): {
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
} {
  const params: ReturnType<typeof koshaCustomerToQBDCreate> = {
    name: customer.name,
  }

  if (customer.primary_contact_email) {
    params.email = customer.primary_contact_email
  }

  if (customer.primary_contact_phone) {
    params.phone = customer.primary_contact_phone
  }

  if (customer.primary_contact_name) {
    params.companyName = customer.name
    params.firstName = customer.primary_contact_name.split(' ')[0]
    const lastName = customer.primary_contact_name.split(' ').slice(1).join(' ')
    if (lastName) {
      params.lastName = lastName
    }
  }

  if (customer.billing_address) {
    params.billingAddress = {
      line1: customer.billing_address.street,
      city: customer.billing_address.city,
      state: customer.billing_address.state,
      postalCode: customer.billing_address.zip,
      country: customer.billing_address.country,
    }
  }

  return params
}

// ============================================
// QBD Inventory Item -> Generic ErpProduct
// ============================================

export function qbdInventoryItemToErp(item: Qbd.InventoryItem): ErpProduct {
  return {
    erpId: item.id,
    name: item.fullName,
    sku: item.sku || null,
    unitPrice: item.salesPrice ? parseFloat(item.salesPrice) : null,
    description: item.salesDescription || null,
    isActive: item.isActive,
    raw: item as unknown as Record<string, unknown>,
  }
}

// ============================================
// QBD Service Item -> Generic ErpProduct
// ============================================

export function qbdServiceItemToErp(item: Qbd.ServiceItem): ErpProduct {
  // Service items can have either salesOrPurchaseDetails or salesAndPurchaseDetails
  const price = item.salesAndPurchaseDetails?.salesPrice
    ?? item.salesOrPurchaseDetails?.price
    ?? null

  const description = item.salesAndPurchaseDetails?.salesDescription
    ?? item.salesOrPurchaseDetails?.description
    ?? null

  return {
    erpId: item.id,
    name: item.fullName,
    sku: null, // Service items don't have SKUs in QBD
    unitPrice: price ? parseFloat(price) : null,
    description,
    isActive: item.isActive,
    raw: item as unknown as Record<string, unknown>,
  }
}

// ============================================
// QBD Non-Inventory Item -> Generic ErpProduct
// ============================================

export function qbdNonInventoryItemToErp(item: Qbd.NonInventoryItem): ErpProduct {
  const price = item.salesAndPurchaseDetails?.salesPrice
    ?? item.salesOrPurchaseDetails?.price
    ?? null

  const description = item.salesAndPurchaseDetails?.salesDescription
    ?? item.salesOrPurchaseDetails?.description
    ?? null

  return {
    erpId: item.id,
    name: item.fullName,
    sku: null, // Non-inventory items don't have SKUs in QBD
    unitPrice: price ? parseFloat(price) : null,
    description,
    isActive: item.isActive,
    raw: item as unknown as Record<string, unknown>,
  }
}

// ============================================
// Kosha Order -> QBD Invoice create params
// ============================================

interface ItemRef {
  qbdItemId: string
  qbdItemName: string
}

export function koshaOrderToQBDInvoice(
  order: Order,
  items: OrderItem[],
  customerQbdId: string,
  itemRefs: Map<string, ItemRef>
): {
  customerId: string
  transactionDate: string
  refNumber?: string
  dueDate?: string
  lines: Array<{
    itemId?: string
    description?: string
    quantity?: number
    rate?: string
  }>
} {
  const lines = items
    .filter(item => !item.deleted)
    .map(item => {
      const ref = itemRefs.get(item.id)

      if (ref) {
        return {
          itemId: ref.qbdItemId,
          description: `${item.name}${item.sku ? ` (${item.sku})` : ''}`,
          quantity: item.quantity,
          rate: item.unit_price.toFixed(2),
        }
      }

      // Unmapped item — description-only line (no itemId)
      return {
        description: `${item.name}${item.sku ? ` (${item.sku})` : ''} - ${item.quantity} ${item.quantity_unit}`,
        quantity: item.quantity,
        rate: item.unit_price.toFixed(2),
      }
    })

  const params: ReturnType<typeof koshaOrderToQBDInvoice> = {
    customerId: customerQbdId,
    transactionDate: (order.received_date || new Date().toISOString()).split('T')[0],
    lines,
  }

  if (order.order_number) {
    params.refNumber = order.order_number
  }

  if (order.expected_date) {
    params.dueDate = order.expected_date.split('T')[0]
  }

  return params
}
