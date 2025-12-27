/**
 * Order Field Configuration
 *
 * Org-specific required fields come from organizations.required_order_fields in DB.
 * This module provides helpers for validation and prompt generation.
 */

export interface OrgRequiredField {
  field: string
  label: string
  type: 'text' | 'number'
  required: boolean
}

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

IMPORTANT: Look for these field values ANYWHERE in the email - in the body, notes section, comments, attachments, or any other location.
For example, a liquor license number might appear in the "Note:" field of an order email. Extract it from wherever you find it.

Example orgFields format: { ${exampleFields} }

If any required org field is not found, add it to missingInfo (e.g., "Missing ${requiredFields[0]?.label || 'field'}").
`
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
    if (value === null || value === undefined || value === '') {
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
