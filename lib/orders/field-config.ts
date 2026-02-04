/**
 * Order Field Configuration
 *
 * Base required fields are hardcoded and apply to ALL organizations.
 * Org-specific required fields come from organizations.required_order_fields in DB.
 * This module provides helpers for validation and prompt generation.
 */

export interface OrgRequiredField {
  field: string
  label: string
  type: 'text' | 'number'
  required: boolean
}

// =============================================================================
// Base Required Fields (apply to ALL organizations)
// =============================================================================

interface BaseRequiredField {
  field: string
  label: string
}

/**
 * Base required fields that must be present on every order.
 * These are validated independently of AI - the AI may miss them but we catch it.
 */
export const BASE_REQUIRED_ORDER_FIELDS: BaseRequiredField[] = [
  { field: 'company_name', label: 'Company Name' },
]

/**
 * Base required fields for each order item.
 * Every item must have these fields filled in.
 */
export const BASE_REQUIRED_ITEM_FIELDS: BaseRequiredField[] = [
  { field: 'name', label: 'Item Name' },
  { field: 'quantity', label: 'Quantity' },
  { field: 'quantity_unit', label: 'Quantity Unit' },
  { field: 'unit_price', label: 'Unit Price' },
]

/**
 * Generate AI prompt instructions for org-specific required fields
 */
export function generateOrgFieldPromptInstructions(orgFields: OrgRequiredField[]): string {
  if (orgFields.length === 0) return ''

  const requiredFields = orgFields.filter(f => f.required)
  if (requiredFields.length === 0) return ''

  const fieldsList = requiredFields
    .map(f => `- "${f.field}": ${f.label} (${f.type === 'number' ? 'numeric value' : 'text value'})`)
    .join('\n')

  const exampleFields = requiredFields
    .map(f => `"${f.field}": "${f.type === 'number' ? '12345' : 'value'}"`)
    .join(', ')

  return `

ADDITIONAL REQUIRED FIELDS FOR THIS ORGANIZATION:
Extract these fields and include them in the "orgFields" object:
${fieldsList}

Search the entire email (body, notes, comments, signatures) for these values.
IMPORTANT: If a value is not found, use null (not "N/A", "unknown", or "-"). Missing values will be flagged for clarification.
Format: { ${exampleFields} } or null if not found
`
}

/**
 * Check if a value is empty or a placeholder (N/A, unknown, etc.)
 */
function isEmptyOrPlaceholder(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return true
  }

  // Check for placeholder strings
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    const placeholders = ['n/a', 'na', 'unknown', 'not found', 'not provided', 'none', 'null', '-', '--']
    return placeholders.includes(normalized)
  }

  return false
}

/**
 * Validate org-specific required fields on an order
 */
export function validateOrgRequiredFields(
  order: Record<string, unknown>,
  orgFields: OrgRequiredField[]
): { isComplete: boolean; missingFields: string[] } {
  const missingFields: string[] = []

  for (const field of orgFields.filter(f => f.required)) {
    const value = order[field.field]
    if (isEmptyOrPlaceholder(value)) {
      missingFields.push(field.label)
    }
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  }
}

/**
 * Get org required fields from organization data
 */
export function getOrgRequiredFields(
  orgRequiredFields: unknown
): OrgRequiredField[] {
  if (!orgRequiredFields || !Array.isArray(orgRequiredFields)) {
    return []
  }
  return orgRequiredFields as OrgRequiredField[]
}

// =============================================================================
// Base Required Fields Validation
// =============================================================================

/**
 * Item data structure for validation (matches what we get from DB or AI)
 */
export interface OrderItemForValidation {
  name?: string | null
  quantity?: number | null
  quantity_unit?: string | null
  unit_price?: number | null
}

/**
 * Validate base required fields on an order (fields required for ALL organizations)
 *
 * @param orderData - Order data with company_name, etc.
 * @param items - Array of order items to validate
 * @returns Validation result with isComplete flag and list of missing fields
 */
export function validateBaseRequiredFields(
  orderData: { company_name?: string | null },
  items: OrderItemForValidation[]
): { isComplete: boolean; missingFields: string[] } {
  const missingFields: string[] = []

  // Check order-level required fields
  for (const field of BASE_REQUIRED_ORDER_FIELDS) {
    const value = orderData[field.field as keyof typeof orderData]
    if (isEmptyOrPlaceholder(value)) {
      missingFields.push(field.label)
    }
  }

  // Check that order has at least one item
  if (items.length === 0) {
    missingFields.push('At least one item')
  }

  // Check item-level required fields
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const itemName = item.name || `Item ${i + 1}`

    // Check name
    if (isEmptyOrPlaceholder(item.name)) {
      missingFields.push(`Item Name (${itemName})`)
    }

    // Check quantity (must be > 0)
    if (item.quantity === null || item.quantity === undefined || item.quantity <= 0) {
      missingFields.push(`Quantity for ${itemName}`)
    }

    // Check quantity_unit
    if (isEmptyOrPlaceholder(item.quantity_unit)) {
      missingFields.push(`Quantity Unit for ${itemName}`)
    }

    // Check unit_price (must be >= 0, we allow 0 for free items but not null/undefined)
    if (item.unit_price === null || item.unit_price === undefined) {
      missingFields.push(`Unit Price for ${itemName}`)
    }
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  }
}

/**
 * Generate AI prompt instructions for base required fields.
 * This ensures the AI knows what fields are always required.
 */
export function generateBaseFieldPromptInstructions(): string {
  const orderFields = BASE_REQUIRED_ORDER_FIELDS.map(f => `- ${f.label}`).join('\n')
  const itemFields = BASE_REQUIRED_ITEM_FIELDS.map(f => `- ${f.label}`).join('\n')

  return `
REQUIRED ORDER FIELDS (must have for order to be complete):
${orderFields}

REQUIRED FOR EVERY ITEM (must have for each line item):
${itemFields}

If ANY of these are missing, set isComplete = false and list them in missingInfo.`
}
