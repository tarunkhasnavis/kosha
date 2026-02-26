/**
 * QuickBooks Online - Data Mappers
 *
 * Pure transform functions between Kosha data and QBO data.
 * No side effects, no API calls, no DB access.
 */

import type { ErpCustomer, ErpProduct } from '../../types'
import type { Customer } from '@/types/customers'
import type { Product } from '@/types/products'
import type { Order, OrderItem } from '@/types/orders'
import type { QBOCustomer, QBOItem } from './types'

// ============================================
// QBO -> Generic ErpCustomer
// ============================================

/**
 * Transform a QBO Customer into the generic ErpCustomer format.
 * Used by pullCustomers() to return provider-agnostic data.
 */
export function qboCustomerToErp(qbo: QBOCustomer): ErpCustomer {
  return {
    erpId: qbo.Id,
    displayName: qbo.DisplayName,
    email: qbo.PrimaryEmailAddr?.Address || null,
    phone: qbo.PrimaryPhone?.FreeFormNumber || null,
    companyName: qbo.CompanyName || null,
    billingAddress: qbo.BillAddr
      ? {
          street: qbo.BillAddr.Line1,
          city: qbo.BillAddr.City,
          state: qbo.BillAddr.CountrySubDivisionCode,
          zip: qbo.BillAddr.PostalCode,
          country: qbo.BillAddr.Country,
        }
      : null,
    raw: qbo as unknown as Record<string, unknown>,
  }
}

// ============================================
// Kosha Customer -> QBO create/update payload
// ============================================

/**
 * Transform a Kosha Customer into a QBO Customer create payload.
 */
export function koshaCustomerToQBOCreate(customer: Customer): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    DisplayName: customer.name,
  }

  if (customer.primary_contact_email) {
    payload.PrimaryEmailAddr = { Address: customer.primary_contact_email }
  }

  if (customer.primary_contact_phone) {
    payload.PrimaryPhone = { FreeFormNumber: customer.primary_contact_phone }
  }

  if (customer.billing_address) {
    payload.BillAddr = {
      Line1: customer.billing_address.street,
      City: customer.billing_address.city,
      CountrySubDivisionCode: customer.billing_address.state,
      PostalCode: customer.billing_address.zip,
      Country: customer.billing_address.country,
    }
  }

  // Set CompanyName if it differs from DisplayName
  // QBO uses DisplayName as the primary identifier
  if (customer.primary_contact_name) {
    payload.CompanyName = customer.name
    payload.GivenName = customer.primary_contact_name.split(' ')[0]
    const lastName = customer.primary_contact_name.split(' ').slice(1).join(' ')
    if (lastName) {
      payload.FamilyName = lastName
    }
  }

  return payload
}

/**
 * Transform a Kosha Customer into a QBO Customer update payload.
 * Requires the QBO Id and SyncToken for optimistic locking.
 */
export function koshaCustomerToQBOUpdate(
  customer: Customer,
  qboId: string,
  syncToken: string
): Record<string, unknown> {
  return {
    ...koshaCustomerToQBOCreate(customer),
    Id: qboId,
    SyncToken: syncToken,
  }
}

// ============================================
// QBO -> Generic ErpProduct
// ============================================

/**
 * Transform a QBO Item into the generic ErpProduct format.
 * Used by pullProducts() to return provider-agnostic data.
 */
export function qboItemToErp(qbo: QBOItem): ErpProduct {
  return {
    erpId: qbo.Id,
    name: qbo.Name,
    sku: qbo.Sku || null,
    unitPrice: qbo.UnitPrice ?? null,
    description: qbo.Description || null,
    isActive: qbo.Active,
    raw: qbo as unknown as Record<string, unknown>,
  }
}

// ============================================
// Kosha Product -> QBO Item
// ============================================

/**
 * Transform a Kosha Product into a QBO Item create payload.
 *
 * QBO requires an IncomeAccountRef for Service/NonInventory items.
 * The caller must provide the income account ID (fetched once per org).
 */
export function koshaProductToQBOCreate(
  product: Product,
  incomeAccountId: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    Name: product.name,
    Type: 'NonInventory',
    IncomeAccountRef: { value: incomeAccountId },
    UnitPrice: product.unit_price,
    Active: product.is_active,
  }

  if (product.sku) {
    payload.Sku = product.sku
  }

  return payload
}

// ============================================
// Kosha Order -> QBO Invoice
// ============================================

/**
 * Item reference for mapping Kosha order items to QBO invoice lines.
 * The caller resolves which QBO Item ID corresponds to each order item.
 */
interface ItemRef {
  qboItemId: string
  qboItemName: string
}

/**
 * Transform a Kosha Order + items into a QBO Invoice create payload.
 *
 * Requires:
 * - customerRef: the QBO Customer ID for the invoice
 * - itemRefs: map of order_item.id -> QBO Item reference (pre-resolved by caller)
 *
 * Items without a QBO mapping are included as description-only lines
 * (no ItemRef, just Amount + Description).
 */
export function koshaOrderToQBOInvoice(
  order: Order,
  items: OrderItem[],
  customerQboId: string,
  itemRefs: Map<string, ItemRef>
): Record<string, unknown> {
  const lines: Record<string, unknown>[] = items
    .filter(item => !item.deleted)
    .map(item => {
      const ref = itemRefs.get(item.id)

      if (ref) {
        // Mapped item — full SalesItemLineDetail
        return {
          Amount: item.total,
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: { value: ref.qboItemId, name: ref.qboItemName },
            Qty: item.quantity,
            UnitPrice: item.unit_price,
          },
        }
      }

      // Unmapped item — description-only line with a generic service item
      return {
        Amount: item.total,
        DetailType: 'SalesItemLineDetail',
        Description: `${item.name}${item.sku ? ` (${item.sku})` : ''}`,
        SalesItemLineDetail: {
          Qty: item.quantity,
          UnitPrice: item.unit_price,
        },
      }
    })

  const payload: Record<string, unknown> = {
    CustomerRef: { value: customerQboId },
    Line: lines,
  }

  // Use order number as DocNumber if available
  if (order.order_number) {
    payload.DocNumber = order.order_number
  }

  // Set the transaction date
  if (order.received_date) {
    payload.TxnDate = order.received_date.split('T')[0]
  }

  // Set due date if expected_date is available
  if (order.expected_date) {
    payload.DueDate = order.expected_date.split('T')[0]
  }

  return payload
}
