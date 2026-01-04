/**
 * Order Completeness Calculation Utility
 *
 * Pure utility functions for calculating order completeness based on filled fields.
 * Used by OrderEditModal to show completion percentage and highlight missing fields.
 */

import type { Order } from "@/types/orders"
import type { OrgRequiredField } from "./field-config"

// =============================================================================
// Types
// =============================================================================

/**
 * Editable item structure used in the order edit form
 */
export interface EditableItem {
  id: string
  name: string
  sku: string
  quantity: number
  quantity_unit: string
  unit_price: string
  total: number
  isNew?: boolean
}

/**
 * Field definition for completeness tracking
 * - required: true means the field MUST be filled for order to be complete
 * - required: false means it's nice-to-have but doesn't affect completeness
 */
interface FieldDefinition {
  key: string
  label: string
  required: boolean
}

/**
 * Result of completeness calculation
 */
export interface CompletenessResult {
  /** Percentage of required fields filled (0-100) */
  percentage: number
  /** Total number of required fields checked */
  totalFields: number
  /** Number of required fields that have values */
  filledFields: number
  /** Labels of required fields that are missing */
  missingRequiredFields: string[]
  /** Map of itemId -> array of missing field keys for that item */
  itemMissingFields: Map<string, string[]>
}

// =============================================================================
// Field Definitions
// =============================================================================

/** Order-level required fields to check for completeness */
export const ORDER_FIELDS: FieldDefinition[] = [
  { key: 'company_name', label: 'Company Name', required: true },
]

/** Item-level required fields to check for completeness (per item) */
export const ITEM_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'Item Name', required: true },
  { key: 'quantity', label: 'Quantity', required: true },
  { key: 'quantity_unit', label: 'Unit', required: true },
  { key: 'unit_price', label: 'Unit Price', required: true },
]

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if an item field is filled based on field key
 */
function isItemFieldFilled(item: EditableItem, fieldKey: string): boolean {
  switch (fieldKey) {
    case 'name':
      return item.name.trim() !== ''
    case 'sku':
      return item.sku.trim() !== ''
    case 'quantity':
      return item.quantity > 0
    case 'quantity_unit':
      return item.quantity_unit.trim() !== ''
    case 'unit_price':
      const price = parseFloat(item.unit_price)
      return !isNaN(price) && price > 0
    default:
      return false
  }
}

// =============================================================================
// Main Calculation Function
// =============================================================================

/**
 * Calculate order completeness based on filled fields
 *
 * Checks:
 * - Order-level fields (company_name, contact info, etc.)
 * - Org-specific required fields (from custom_fields)
 * - Item-level fields (name, sku, quantity, price for each item)
 *
 * @param order - The order being edited
 * @param items - Current state of editable items
 * @param orgRequiredFields - Organization-specific required fields config
 * @returns CompletenessResult with percentage and missing field info
 */
export function calculateCompleteness(
  order: Order,
  items: EditableItem[],
  orgRequiredFields: OrgRequiredField[]
): CompletenessResult {
  const missingRequiredFields: string[] = []
  const itemMissingFields = new Map<string, string[]>()

  let totalFields = 0
  let filledFields = 0

  // Check order-level fields
  for (const field of ORDER_FIELDS) {
    totalFields++
    const value = order[field.key as keyof Order]
    const isFilled = value !== null && value !== undefined && value !== ''

    if (isFilled) {
      filledFields++
    } else {
      missingRequiredFields.push(field.label)
    }
  }

  // Check org-specific required fields from custom_fields
  const customFields = order.custom_fields || {}
  for (const field of orgRequiredFields.filter(f => f.required)) {
    totalFields++
    const value = customFields[field.field]
    const isFilled = value !== null && value !== undefined && value !== ''

    if (isFilled) {
      filledFields++
    } else {
      missingRequiredFields.push(field.label)
    }
  }

  // Check item-level fields
  for (const item of items) {
    const itemMissing: string[] = []

    for (const field of ITEM_FIELDS) {
      totalFields++
      const isFilled = isItemFieldFilled(item, field.key)

      if (isFilled) {
        filledFields++
      } else {
        itemMissing.push(field.key)
        if (field.required) {
          // Only add to missing required if not already there
          const label = `${field.label} (Item: ${item.name || 'Unnamed'})`
          if (!missingRequiredFields.includes(label)) {
            missingRequiredFields.push(label)
          }
        }
      }
    }

    if (itemMissing.length > 0) {
      itemMissingFields.set(item.id, itemMissing)
    }
  }

  // Calculate percentage
  const percentage = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0

  return {
    percentage,
    totalFields,
    filledFields,
    missingRequiredFields,
    itemMissingFields,
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Compare two item arrays to detect if there are changes
 */
export function hasItemsChanged(current: EditableItem[], original: EditableItem[]): boolean {
  if (current.length !== original.length) return true

  for (let i = 0; i < current.length; i++) {
    const curr = current[i]
    const orig = original[i]
    if (
      curr.name !== orig.name ||
      curr.sku !== orig.sku ||
      curr.quantity !== orig.quantity ||
      curr.quantity_unit !== orig.quantity_unit ||
      curr.unit_price !== orig.unit_price
    ) {
      return true
    }
  }
  return false
}

/**
 * Generate a temporary ID for new items
 */
export function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
