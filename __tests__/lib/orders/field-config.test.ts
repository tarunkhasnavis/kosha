import { describe, it, expect } from 'vitest'
import {
  generateOrgFieldPromptInstructions,
  validateOrgRequiredFields,
  getOrgRequiredFields,
  validateBaseRequiredFields,
  generateBaseFieldPromptInstructions,
  BASE_REQUIRED_ORDER_FIELDS,
  BASE_REQUIRED_ITEM_FIELDS,
  type OrgRequiredField,
  type OrderItemForValidation,
} from '@/lib/orders/field-config'

// =============================================================================
// Factory Functions
// =============================================================================

function createOrgRequiredField(overrides: Partial<OrgRequiredField> = {}): OrgRequiredField {
  return {
    field: 'custom_field',
    label: 'Custom Field',
    type: 'text',
    required: true,
    ...overrides,
  }
}

function createOrderItem(overrides: Partial<OrderItemForValidation> = {}): OrderItemForValidation {
  return {
    name: 'Test Product',
    quantity: 10,
    quantity_unit: 'units',
    unit_price: 5.0,
    ...overrides,
  }
}

// =============================================================================
// generateOrgFieldPromptInstructions Tests
// =============================================================================

describe('generateOrgFieldPromptInstructions', () => {
  it('returns empty string for empty array', () => {
    const result = generateOrgFieldPromptInstructions([])

    expect(result).toBe('')
  })

  it('returns empty string when no required fields', () => {
    const fields = [createOrgRequiredField({ required: false })]

    const result = generateOrgFieldPromptInstructions(fields)

    expect(result).toBe('')
  })

  it('includes field name and label for required fields', () => {
    const fields = [
      createOrgRequiredField({ field: 'liquor_license', label: 'Liquor License', type: 'text' }),
    ]

    const result = generateOrgFieldPromptInstructions(fields)

    expect(result).toContain('liquor_license')
    expect(result).toContain('Liquor License')
  })

  it('indicates text value type correctly', () => {
    const fields = [createOrgRequiredField({ type: 'text' })]

    const result = generateOrgFieldPromptInstructions(fields)

    expect(result).toContain('text value')
  })

  it('indicates numeric value type correctly', () => {
    const fields = [createOrgRequiredField({ type: 'number' })]

    const result = generateOrgFieldPromptInstructions(fields)

    expect(result).toContain('numeric value')
  })

  it('generates example format with correct values', () => {
    const fields = [
      createOrgRequiredField({ field: 'text_field', type: 'text' }),
      createOrgRequiredField({ field: 'number_field', type: 'number' }),
    ]

    const result = generateOrgFieldPromptInstructions(fields)

    expect(result).toContain('"text_field": "value"')
    expect(result).toContain('"number_field": "12345"')
  })

  it('only includes required fields in output', () => {
    const fields = [
      createOrgRequiredField({ field: 'required_field', required: true }),
      createOrgRequiredField({ field: 'optional_field', required: false }),
    ]

    const result = generateOrgFieldPromptInstructions(fields)

    expect(result).toContain('required_field')
    expect(result).not.toContain('optional_field')
  })

  it('includes instructions about null values', () => {
    const fields = [createOrgRequiredField()]

    const result = generateOrgFieldPromptInstructions(fields)

    expect(result).toContain('null')
    expect(result).toContain('not "N/A"')
  })
})

// =============================================================================
// validateOrgRequiredFields Tests
// =============================================================================

describe('validateOrgRequiredFields', () => {
  it('returns isComplete true when all required fields are filled', () => {
    const order = { liquor_license: '12345' }
    const fields = [createOrgRequiredField({ field: 'liquor_license' })]

    const result = validateOrgRequiredFields(order, fields)

    expect(result.isComplete).toBe(true)
    expect(result.missingFields).toHaveLength(0)
  })

  it('returns isComplete false when required field is missing', () => {
    const order = {}
    const fields = [createOrgRequiredField({ field: 'liquor_license', label: 'Liquor License' })]

    const result = validateOrgRequiredFields(order, fields)

    expect(result.isComplete).toBe(false)
    expect(result.missingFields).toContain('Liquor License')
  })

  it('treats null as missing', () => {
    const order = { custom_field: null }
    const fields = [createOrgRequiredField()]

    const result = validateOrgRequiredFields(order, fields)

    expect(result.isComplete).toBe(false)
  })

  it('treats empty string as missing', () => {
    const order = { custom_field: '' }
    const fields = [createOrgRequiredField()]

    const result = validateOrgRequiredFields(order, fields)

    expect(result.isComplete).toBe(false)
  })

  it('treats "N/A" as missing (case insensitive)', () => {
    const order = { custom_field: 'N/A' }
    const fields = [createOrgRequiredField()]

    const result = validateOrgRequiredFields(order, fields)

    expect(result.isComplete).toBe(false)
  })

  it('treats "n/a" as missing', () => {
    const order = { custom_field: 'n/a' }
    const fields = [createOrgRequiredField()]

    const result = validateOrgRequiredFields(order, fields)

    expect(result.isComplete).toBe(false)
  })

  it('treats "unknown" as missing', () => {
    const order = { custom_field: 'unknown' }
    const fields = [createOrgRequiredField()]

    const result = validateOrgRequiredFields(order, fields)

    expect(result.isComplete).toBe(false)
  })

  it('treats "not found" as missing', () => {
    const order = { custom_field: 'not found' }
    const fields = [createOrgRequiredField()]

    const result = validateOrgRequiredFields(order, fields)

    expect(result.isComplete).toBe(false)
  })

  it('treats "-" as missing', () => {
    const order = { custom_field: '-' }
    const fields = [createOrgRequiredField()]

    const result = validateOrgRequiredFields(order, fields)

    expect(result.isComplete).toBe(false)
  })

  it('treats "--" as missing', () => {
    const order = { custom_field: '--' }
    const fields = [createOrgRequiredField()]

    const result = validateOrgRequiredFields(order, fields)

    expect(result.isComplete).toBe(false)
  })

  it('ignores non-required fields', () => {
    const order = {}
    const fields = [createOrgRequiredField({ required: false })]

    const result = validateOrgRequiredFields(order, fields)

    expect(result.isComplete).toBe(true)
  })

  it('validates multiple required fields', () => {
    const order = { field1: 'value1' }
    const fields = [
      createOrgRequiredField({ field: 'field1', label: 'Field 1' }),
      createOrgRequiredField({ field: 'field2', label: 'Field 2' }),
    ]

    const result = validateOrgRequiredFields(order, fields)

    expect(result.isComplete).toBe(false)
    expect(result.missingFields).toContain('Field 2')
    expect(result.missingFields).not.toContain('Field 1')
  })

  it('accepts numeric values', () => {
    const order = { custom_field: 12345 }
    const fields = [createOrgRequiredField({ type: 'number' })]

    const result = validateOrgRequiredFields(order, fields)

    expect(result.isComplete).toBe(true)
  })

  it('accepts zero as a valid numeric value', () => {
    const order = { custom_field: 0 }
    const fields = [createOrgRequiredField({ type: 'number' })]

    const result = validateOrgRequiredFields(order, fields)

    expect(result.isComplete).toBe(true)
  })
})

// =============================================================================
// getOrgRequiredFields Tests
// =============================================================================

describe('getOrgRequiredFields', () => {
  it('returns empty array for null input', () => {
    const result = getOrgRequiredFields(null)

    expect(result).toEqual([])
  })

  it('returns empty array for undefined input', () => {
    const result = getOrgRequiredFields(undefined)

    expect(result).toEqual([])
  })

  it('returns empty array for non-array input', () => {
    const result = getOrgRequiredFields('not an array')

    expect(result).toEqual([])
  })

  it('returns empty array for object input', () => {
    const result = getOrgRequiredFields({ field: 'value' })

    expect(result).toEqual([])
  })

  it('returns the array as-is when valid', () => {
    const fields = [createOrgRequiredField()]

    const result = getOrgRequiredFields(fields)

    expect(result).toEqual(fields)
  })

  it('returns empty array for empty array input', () => {
    const result = getOrgRequiredFields([])

    expect(result).toEqual([])
  })
})

// =============================================================================
// validateBaseRequiredFields Tests
// =============================================================================

describe('validateBaseRequiredFields', () => {
  it('returns isComplete true when all fields are filled', () => {
    const orderData = { company_name: 'Test Company' }
    const items = [createOrderItem()]

    const result = validateBaseRequiredFields(orderData, items)

    expect(result.isComplete).toBe(true)
    expect(result.missingFields).toHaveLength(0)
  })

  it('identifies missing company_name', () => {
    const orderData = { company_name: '' }
    const items = [createOrderItem()]

    const result = validateBaseRequiredFields(orderData, items)

    expect(result.isComplete).toBe(false)
    expect(result.missingFields).toContain('Company Name')
  })

  it('identifies null company_name as missing', () => {
    const orderData = { company_name: null }
    const items = [createOrderItem()]

    const result = validateBaseRequiredFields(orderData, items)

    expect(result.isComplete).toBe(false)
    expect(result.missingFields).toContain('Company Name')
  })

  it('requires at least one item', () => {
    const orderData = { company_name: 'Test Company' }
    const items: OrderItemForValidation[] = []

    const result = validateBaseRequiredFields(orderData, items)

    expect(result.isComplete).toBe(false)
    expect(result.missingFields).toContain('At least one item')
  })

  it('validates item name is present', () => {
    const orderData = { company_name: 'Test Company' }
    const items = [createOrderItem({ name: '' })]

    const result = validateBaseRequiredFields(orderData, items)

    expect(result.isComplete).toBe(false)
    expect(result.missingFields.some(f => f.includes('Item Name'))).toBe(true)
  })

  it('validates item quantity is greater than 0', () => {
    const orderData = { company_name: 'Test Company' }
    const items = [createOrderItem({ quantity: 0 })]

    const result = validateBaseRequiredFields(orderData, items)

    expect(result.isComplete).toBe(false)
    expect(result.missingFields.some(f => f.includes('Quantity'))).toBe(true)
  })

  it('validates item quantity is not null', () => {
    const orderData = { company_name: 'Test Company' }
    const items = [createOrderItem({ quantity: null })]

    const result = validateBaseRequiredFields(orderData, items)

    expect(result.isComplete).toBe(false)
  })

  it('validates item quantity_unit is present', () => {
    const orderData = { company_name: 'Test Company' }
    const items = [createOrderItem({ quantity_unit: '' })]

    const result = validateBaseRequiredFields(orderData, items)

    expect(result.isComplete).toBe(false)
    expect(result.missingFields.some(f => f.includes('Quantity Unit'))).toBe(true)
  })

  it('validates item unit_price is not null', () => {
    const orderData = { company_name: 'Test Company' }
    const items = [createOrderItem({ unit_price: null })]

    const result = validateBaseRequiredFields(orderData, items)

    expect(result.isComplete).toBe(false)
    expect(result.missingFields.some(f => f.includes('Unit Price'))).toBe(true)
  })

  it('allows unit_price of 0 (free items)', () => {
    const orderData = { company_name: 'Test Company' }
    const items = [createOrderItem({ unit_price: 0 })]

    const result = validateBaseRequiredFields(orderData, items)

    expect(result.missingFields.some(f => f.includes('Unit Price'))).toBe(false)
  })

  it('validates multiple items independently', () => {
    const orderData = { company_name: 'Test Company' }
    const items = [
      createOrderItem({ name: 'Item 1' }),
      createOrderItem({ name: '', quantity: 0 }),
    ]

    const result = validateBaseRequiredFields(orderData, items)

    expect(result.isComplete).toBe(false)
    expect(result.missingFields.length).toBeGreaterThan(0)
  })

  it('uses item name in error messages when available', () => {
    const orderData = { company_name: 'Test Company' }
    const items = [createOrderItem({ name: 'Widget', quantity: 0 })]

    const result = validateBaseRequiredFields(orderData, items)

    expect(result.missingFields.some(f => f.includes('Widget'))).toBe(true)
  })

  it('uses fallback item name when name is empty', () => {
    const orderData = { company_name: 'Test Company' }
    const items = [createOrderItem({ name: '' })]

    const result = validateBaseRequiredFields(orderData, items)

    expect(result.missingFields.some(f => f.includes('Item 1'))).toBe(true)
  })
})

// =============================================================================
// generateBaseFieldPromptInstructions Tests
// =============================================================================

describe('generateBaseFieldPromptInstructions', () => {
  it('includes all base required order fields', () => {
    const result = generateBaseFieldPromptInstructions()

    for (const field of BASE_REQUIRED_ORDER_FIELDS) {
      expect(result).toContain(field.label)
    }
  })

  it('includes all base required item fields', () => {
    const result = generateBaseFieldPromptInstructions()

    for (const field of BASE_REQUIRED_ITEM_FIELDS) {
      expect(result).toContain(field.label)
    }
  })

  it('includes instruction about isComplete flag', () => {
    const result = generateBaseFieldPromptInstructions()

    expect(result).toContain('isComplete')
    expect(result).toContain('false')
  })

  it('includes instruction about missingInfo', () => {
    const result = generateBaseFieldPromptInstructions()

    expect(result).toContain('missingInfo')
  })
})

// =============================================================================
// Constants Tests
// =============================================================================

describe('BASE_REQUIRED_ORDER_FIELDS', () => {
  it('includes company_name', () => {
    const hasCompanyName = BASE_REQUIRED_ORDER_FIELDS.some(f => f.field === 'company_name')

    expect(hasCompanyName).toBe(true)
  })
})

describe('BASE_REQUIRED_ITEM_FIELDS', () => {
  it('includes name, quantity, quantity_unit, and unit_price', () => {
    const fields = BASE_REQUIRED_ITEM_FIELDS.map(f => f.field)

    expect(fields).toContain('name')
    expect(fields).toContain('quantity')
    expect(fields).toContain('quantity_unit')
    expect(fields).toContain('unit_price')
  })
})
