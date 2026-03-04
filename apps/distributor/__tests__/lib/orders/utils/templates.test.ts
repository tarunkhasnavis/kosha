import { describe, it, expect } from 'vitest'
import {
  generateApprovalEmail,
  generateRejectionEmail,
} from '@/lib/orders/utils/templates'
import type { OrderItem } from '@kosha/types'

// Factory function for creating test order items
function createOrderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'item-1',
    order_id: 'order-1',
    name: 'Test Product',
    quantity: 10,
    quantity_unit: 'units',
    unit_price: 5.0,
    total: 50.0,
    ...overrides,
  }
}

// Factory function for creating test order summaries
function createOrderSummary(overrides: Partial<Parameters<typeof generateApprovalEmail>[0]> = {}) {
  return {
    orderNumber: 'ORD-001',
    companyName: 'Test Company',
    contactName: 'John Smith',
    items: [createOrderItem()],
    orderValue: 50.0,
    ...overrides,
  }
}

describe('generateApprovalEmail', () => {
  it('generates email with contact first name greeting', () => {
    const order = createOrderSummary({ contactName: 'John Smith' })
    const email = generateApprovalEmail(order, 'Kosha Foods')

    expect(email).toContain('Hi John,')
    expect(email).toContain('ORDER #ORD-001')
    expect(email).toContain('Test Product')
    expect(email).toContain('$50.00')
    expect(email).toContain('Kosha Foods')
  })

  it('uses company name when contact name is missing', () => {
    const order = createOrderSummary({
      contactName: undefined,
      companyName: 'Acme Corp',
    })
    const email = generateApprovalEmail(order, 'Kosha Foods')

    expect(email).toContain('Hi Acme Corp,')
  })

  it('uses "there" when both names are missing', () => {
    const order = createOrderSummary({
      contactName: undefined,
      companyName: undefined,
    })
    const email = generateApprovalEmail(order, 'Kosha Foods')

    expect(email).toContain('Hi there,')
  })

  it('includes expected date when provided', () => {
    const order = createOrderSummary({ expectedDate: '2024-03-20T12:00:00Z' })
    const email = generateApprovalEmail(order, 'Kosha Foods')

    expect(email).toContain('Delivery Date:')
    expect(email).toMatch(/March \d{1,2}, 2024/)
  })

  it('formats multiple items correctly', () => {
    const order = createOrderSummary({
      items: [
        createOrderItem({ name: 'Product A', quantity: 5, total: 25.0 }),
        createOrderItem({ name: 'Product B', quantity: 10, total: 100.0 }),
      ],
      orderValue: 125.0,
    })
    const email = generateApprovalEmail(order, 'Kosha Foods')

    expect(email).toContain('Product A')
    expect(email).toContain('Product B')
    expect(email).toContain('$125.00')
  })

  it('includes deleted items section when present', () => {
    const order = createOrderSummary({
      deletedItems: [
        createOrderItem({ name: 'Removed Product', quantity: 2, total: 20.0 }),
      ],
    })
    const email = generateApprovalEmail(order, 'Kosha Foods')

    expect(email).toContain('removed from your original order')
    expect(email).toContain('Removed Product')
  })
})

describe('generateRejectionEmail', () => {
  it('generates rejection email with order number', () => {
    const order = createOrderSummary()
    const email = generateRejectionEmail(order, 'Kosha Foods')

    expect(email).toContain('Hi John,')
    expect(email).toContain('#ORD-001')
    expect(email).toContain('unable to process')
    expect(email).toContain('Kosha Foods')
  })

  it('includes reason when provided', () => {
    const order = createOrderSummary()
    const email = generateRejectionEmail(
      order,
      'Kosha Foods',
      'Out of stock for requested items'
    )

    expect(email).toContain('Reason: Out of stock for requested items')
  })

  it('omits reason section when not provided', () => {
    const order = createOrderSummary()
    const email = generateRejectionEmail(order, 'Kosha Foods')

    expect(email).not.toContain('Reason:')
  })

  it('uses fallback greeting when names are missing', () => {
    const order = createOrderSummary({
      contactName: undefined,
      companyName: undefined,
    })
    const email = generateRejectionEmail(order, 'Kosha Foods')

    expect(email).toContain('Hi there,')
  })
})
