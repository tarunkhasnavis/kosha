import { describe, it, expect } from 'vitest'
import {
  calculateCompleteness,
  hasItemsChanged,
  generateTempId,
  ORDER_FIELDS,
  ITEM_FIELDS,
  type EditableItem,
} from '@/lib/orders/completeness'
import type { Order } from '@kosha/types'
import type { OrgRequiredField } from '@/lib/orders/field-config'

// =============================================================================
// Factory Functions
// =============================================================================

function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    order_number: 'ORD-001',
    company_name: 'Test Company',
    source: 'email',
    status: 'waiting_review',
    received_date: '2024-01-01',
    order_value: 100,
    item_count: 1,
    ship_via: 'Delivery',
    ...overrides,
  }
}

function createEditableItem(overrides: Partial<EditableItem> = {}): EditableItem {
  return {
    id: 'item-1',
    name: 'Test Product',
    sku: 'SKU-001',
    quantity: 10,
    quantity_unit: 'units',
    unit_price: '5.00',
    total: 50,
    ...overrides,
  }
}

function createOrgRequiredField(overrides: Partial<OrgRequiredField> = {}): OrgRequiredField {
  return {
    field: 'custom_field',
    label: 'Custom Field',
    type: 'text',
    required: true,
    ...overrides,
  }
}

// =============================================================================
// calculateCompleteness Tests
// =============================================================================

describe('calculateCompleteness', () => {
  describe('order-level fields', () => {
    it('returns 100% when all order fields are filled', () => {
      const order = createOrder()
      const items = [createEditableItem()]

      const result = calculateCompleteness(order, items, [])

      expect(result.percentage).toBe(100)
      expect(result.missingRequiredFields).toHaveLength(0)
    })

    it('identifies missing company_name', () => {
      const order = createOrder({ company_name: '' })
      const items = [createEditableItem()]

      const result = calculateCompleteness(order, items, [])

      expect(result.missingRequiredFields).toContain('Company Name')
    })

    it('identifies missing ship_via', () => {
      const order = createOrder({ ship_via: '' })
      const items = [createEditableItem()]

      const result = calculateCompleteness(order, items, [])

      expect(result.missingRequiredFields).toContain('Ship Via')
    })

    it('uses editedFields override for ship_via', () => {
      const order = createOrder({ ship_via: '' })
      const items = [createEditableItem()]

      const result = calculateCompleteness(order, items, [], { ship_via: 'Pickup' })

      expect(result.missingRequiredFields).not.toContain('Ship Via')
    })

    it('treats null values as missing', () => {
      const order = createOrder({ company_name: null as unknown as string })
      const items = [createEditableItem()]

      const result = calculateCompleteness(order, items, [])

      expect(result.missingRequiredFields).toContain('Company Name')
    })

    it('treats undefined values as missing', () => {
      const order = createOrder({ ship_via: undefined })
      const items = [createEditableItem()]

      const result = calculateCompleteness(order, items, [])

      expect(result.missingRequiredFields).toContain('Ship Via')
    })
  })

  describe('org-specific required fields', () => {
    it('validates org-specific required fields from custom_fields', () => {
      const order = createOrder({
        custom_fields: { liquor_license: '12345' },
      })
      const items = [createEditableItem()]
      const orgFields = [createOrgRequiredField({ field: 'liquor_license', label: 'Liquor License' })]

      const result = calculateCompleteness(order, items, orgFields)

      expect(result.missingRequiredFields).not.toContain('Liquor License')
    })

    it('identifies missing org-specific required fields', () => {
      const order = createOrder({ custom_fields: {} })
      const items = [createEditableItem()]
      const orgFields = [createOrgRequiredField({ field: 'liquor_license', label: 'Liquor License' })]

      const result = calculateCompleteness(order, items, orgFields)

      expect(result.missingRequiredFields).toContain('Liquor License')
    })

    it('ignores non-required org fields', () => {
      const order = createOrder({ custom_fields: {} })
      const items = [createEditableItem()]
      const orgFields = [createOrgRequiredField({ field: 'optional_field', label: 'Optional', required: false })]

      const result = calculateCompleteness(order, items, orgFields)

      expect(result.missingRequiredFields).not.toContain('Optional')
    })

    it('handles null custom_fields gracefully', () => {
      const order = createOrder({ custom_fields: undefined })
      const items = [createEditableItem()]
      const orgFields = [createOrgRequiredField()]

      const result = calculateCompleteness(order, items, orgFields)

      expect(result.missingRequiredFields).toContain('Custom Field')
    })
  })

  describe('item-level fields', () => {
    it('validates item name is filled', () => {
      const order = createOrder()
      const items = [createEditableItem({ name: '' })]

      const result = calculateCompleteness(order, items, [])

      expect(result.missingRequiredFields).toContain('Item Name (Item: Unnamed)')
    })

    it('validates item quantity is greater than 0', () => {
      const order = createOrder()
      const items = [createEditableItem({ quantity: 0 })]

      const result = calculateCompleteness(order, items, [])

      expect(result.missingRequiredFields).toContain('Quantity (Item: Test Product)')
    })

    it('validates item quantity_unit is filled', () => {
      const order = createOrder()
      const items = [createEditableItem({ quantity_unit: '' })]

      const result = calculateCompleteness(order, items, [])

      expect(result.missingRequiredFields).toContain('Unit (Item: Test Product)')
    })

    it('validates item unit_price is a valid positive number', () => {
      const order = createOrder()
      const items = [createEditableItem({ unit_price: '0' })]

      const result = calculateCompleteness(order, items, [])

      expect(result.missingRequiredFields).toContain('Unit Price (Item: Test Product)')
    })

    it('treats non-numeric unit_price as missing', () => {
      const order = createOrder()
      const items = [createEditableItem({ unit_price: 'invalid' })]

      const result = calculateCompleteness(order, items, [])

      expect(result.missingRequiredFields).toContain('Unit Price (Item: Test Product)')
    })

    it('tracks missing fields per item in itemMissingFields map', () => {
      const order = createOrder()
      const items = [
        createEditableItem({ id: 'item-1', name: '', quantity: 0 }),
      ]

      const result = calculateCompleteness(order, items, [])

      expect(result.itemMissingFields.get('item-1')).toContain('name')
      expect(result.itemMissingFields.get('item-1')).toContain('quantity')
    })

    it('handles multiple items correctly', () => {
      const order = createOrder()
      const items = [
        createEditableItem({ id: 'item-1' }),
        createEditableItem({ id: 'item-2', name: '' }),
      ]

      const result = calculateCompleteness(order, items, [])

      expect(result.itemMissingFields.has('item-1')).toBe(false)
      expect(result.itemMissingFields.get('item-2')).toContain('name')
    })
  })

  describe('percentage calculation', () => {
    it('calculates correct percentage with all fields filled', () => {
      const order = createOrder()
      const items = [createEditableItem()]

      const result = calculateCompleteness(order, items, [])

      expect(result.percentage).toBe(100)
      expect(result.filledFields).toBe(result.totalFields)
    })

    it('calculates correct percentage with some missing fields', () => {
      const order = createOrder({ company_name: '' })
      const items = [createEditableItem()]

      const result = calculateCompleteness(order, items, [])

      expect(result.percentage).toBeLessThan(100)
      expect(result.filledFields).toBeLessThan(result.totalFields)
    })

    it('returns 0% when no fields are provided', () => {
      const order = createOrder({ company_name: '', ship_via: '' })
      const items: EditableItem[] = []

      const result = calculateCompleteness(order, items, [])

      expect(result.percentage).toBe(0)
    })

    it('counts total fields correctly', () => {
      const order = createOrder()
      const items = [createEditableItem()]
      const orgFields = [createOrgRequiredField()]

      const result = calculateCompleteness(order, items, orgFields)

      // 2 order fields + 1 org field + 4 item fields = 7 total
      expect(result.totalFields).toBe(ORDER_FIELDS.length + 1 + ITEM_FIELDS.length)
    })
  })
})

// =============================================================================
// hasItemsChanged Tests
// =============================================================================

describe('hasItemsChanged', () => {
  it('returns false when items are identical', () => {
    const items = [createEditableItem()]
    const original = [createEditableItem()]

    expect(hasItemsChanged(items, original)).toBe(false)
  })

  it('returns true when array lengths differ', () => {
    const items = [createEditableItem(), createEditableItem({ id: 'item-2' })]
    const original = [createEditableItem()]

    expect(hasItemsChanged(items, original)).toBe(true)
  })

  it('returns true when item name changes', () => {
    const items = [createEditableItem({ name: 'New Name' })]
    const original = [createEditableItem({ name: 'Old Name' })]

    expect(hasItemsChanged(items, original)).toBe(true)
  })

  it('returns true when item sku changes', () => {
    const items = [createEditableItem({ sku: 'NEW-SKU' })]
    const original = [createEditableItem({ sku: 'OLD-SKU' })]

    expect(hasItemsChanged(items, original)).toBe(true)
  })

  it('returns true when item quantity changes', () => {
    const items = [createEditableItem({ quantity: 20 })]
    const original = [createEditableItem({ quantity: 10 })]

    expect(hasItemsChanged(items, original)).toBe(true)
  })

  it('returns true when item quantity_unit changes', () => {
    const items = [createEditableItem({ quantity_unit: 'boxes' })]
    const original = [createEditableItem({ quantity_unit: 'units' })]

    expect(hasItemsChanged(items, original)).toBe(true)
  })

  it('returns true when item unit_price changes', () => {
    const items = [createEditableItem({ unit_price: '10.00' })]
    const original = [createEditableItem({ unit_price: '5.00' })]

    expect(hasItemsChanged(items, original)).toBe(true)
  })

  it('returns false for empty arrays', () => {
    expect(hasItemsChanged([], [])).toBe(false)
  })

  it('handles multiple items correctly', () => {
    const items = [
      createEditableItem({ id: 'item-1' }),
      createEditableItem({ id: 'item-2', name: 'Changed' }),
    ]
    const original = [
      createEditableItem({ id: 'item-1' }),
      createEditableItem({ id: 'item-2', name: 'Original' }),
    ]

    expect(hasItemsChanged(items, original)).toBe(true)
  })
})

// =============================================================================
// generateTempId Tests
// =============================================================================

describe('generateTempId', () => {
  it('generates string starting with "temp-"', () => {
    const id = generateTempId()

    expect(id).toMatch(/^temp-/)
  })

  it('includes timestamp in the id', () => {
    const before = Date.now()
    const id = generateTempId()
    const after = Date.now()

    const parts = id.split('-')
    const timestamp = parseInt(parts[1], 10)

    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(after)
  })

  it('generates unique ids', () => {
    const ids = new Set<string>()

    for (let i = 0; i < 100; i++) {
      ids.add(generateTempId())
    }

    expect(ids.size).toBe(100)
  })

  it('follows temp-{timestamp}-{random} pattern', () => {
    const id = generateTempId()

    expect(id).toMatch(/^temp-\d+-[a-z0-9]+$/)
  })
})
