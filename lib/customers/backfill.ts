'use server'

/**
 * Customer Backfill Script
 *
 * Extracts customers from existing orders and creates customer records.
 * Can be run via API endpoint or CLI for specific organizations.
 *
 * This is the TypeScript version of the SQL migration, useful for:
 * - Running on specific organizations
 * - More complex deduplication logic
 * - Progress tracking
 * - Dry-run mode
 */

import { createServiceClient } from '@/utils/supabase/service'
import { normalizeCompanyName, calculateStringSimilarity } from './services'

interface BackfillOptions {
  organizationId?: string  // If not provided, runs for all orgs
  dryRun?: boolean         // If true, don't actually create customers
  similarityThreshold?: number  // For fuzzy deduplication (default: 0.85)
}

interface BackfillResult {
  success: boolean
  customersCreated: number
  ordersLinked: number
  duplicatesMerged: number
  errors: string[]
  details?: CustomerCreationDetail[]
}

interface CustomerCreationDetail {
  name: string
  orderCount: number
  totalSpend: number
  mergedNames?: string[]  // Names that were merged into this customer
}

interface OrderGroup {
  organization_id: string
  company_name: string
  contact_name: string | null
  contact_email: string | null
  phone: string | null
  billing_address: string | null
  order_count: number
  total_spend: number
  first_order_date: string
  last_order_date: string
  order_ids: string[]
}

/**
 * Backfill customers from existing orders
 */
export async function backfillCustomersFromOrders(
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const {
    organizationId,
    dryRun = false,
    similarityThreshold = 0.85
  } = options

  const supabase = createServiceClient()
  const errors: string[] = []
  const details: CustomerCreationDetail[] = []
  let customersCreated = 0
  let ordersLinked = 0
  let duplicatesMerged = 0

  try {
    // Step 1: Get all orders grouped by company_name
    let query = supabase
      .from('orders')
      .select('id, organization_id, company_name, contact_name, contact_email, phone, billing_address, order_value, received_date, status, created_at')
      .not('company_name', 'is', null)
      .is('customer_id', null)  // Only unlinked orders
      .order('received_date', { ascending: false })

    if (organizationId) {
      query = query.eq('organization_id', organizationId)
    }

    const { data: orders, error: ordersError } = await query

    if (ordersError) {
      throw new Error(`Failed to fetch orders: ${ordersError.message}`)
    }

    if (!orders || orders.length === 0) {
      return {
        success: true,
        customersCreated: 0,
        ordersLinked: 0,
        duplicatesMerged: 0,
        errors: [],
        details: []
      }
    }

    // Step 2: Group orders by organization and company name
    const orderGroups = new Map<string, OrderGroup>()

    for (const order of orders) {
      if (!order.company_name) continue

      const key = `${order.organization_id}::${order.company_name.toLowerCase().trim()}`

      if (!orderGroups.has(key)) {
        orderGroups.set(key, {
          organization_id: order.organization_id,
          company_name: order.company_name,
          contact_name: order.contact_name,
          contact_email: order.contact_email,
          phone: order.phone,
          billing_address: order.billing_address,
          order_count: 0,
          total_spend: 0,
          first_order_date: order.received_date,
          last_order_date: order.received_date,
          order_ids: []
        })
      }

      const group = orderGroups.get(key)!
      group.order_ids.push(order.id)

      // Only count non-rejected orders
      if (order.status !== 'rejected') {
        group.order_count++
      }

      // Only sum approved/processing/archived orders
      if (['approved', 'processing', 'archived'].includes(order.status)) {
        group.total_spend += order.order_value || 0
      }

      // Update first/last order dates
      if (order.received_date < group.first_order_date) {
        group.first_order_date = order.received_date
      }
      if (order.received_date > group.last_order_date) {
        group.last_order_date = order.received_date
      }

      // Use most recent order's contact info (orders are sorted by received_date DESC)
      if (!group.contact_name && order.contact_name) {
        group.contact_name = order.contact_name
      }
      if (!group.contact_email && order.contact_email) {
        group.contact_email = order.contact_email
      }
      if (!group.phone && order.phone) {
        group.phone = order.phone
      }
      if (!group.billing_address && order.billing_address) {
        group.billing_address = order.billing_address
      }
    }

    // Step 3: Fuzzy deduplicate similar company names within each org
    const orgGroups = new Map<string, OrderGroup[]>()
    for (const group of orderGroups.values()) {
      if (!orgGroups.has(group.organization_id)) {
        orgGroups.set(group.organization_id, [])
      }
      orgGroups.get(group.organization_id)!.push(group)
    }

    const mergedGroups: OrderGroup[] = []

    for (const [orgId, groups] of orgGroups) {
      const processed = new Set<number>()

      for (let i = 0; i < groups.length; i++) {
        if (processed.has(i)) continue

        const primary = { ...groups[i] }
        const mergedNames: string[] = []

        // Check for similar names
        for (let j = i + 1; j < groups.length; j++) {
          if (processed.has(j)) continue

          const similarity = calculateStringSimilarity(
            normalizeCompanyName(primary.company_name),
            normalizeCompanyName(groups[j].company_name)
          )

          if (similarity >= similarityThreshold) {
            // Merge this group into primary
            processed.add(j)
            duplicatesMerged++
            mergedNames.push(groups[j].company_name)

            // Merge order IDs
            primary.order_ids.push(...groups[j].order_ids)

            // Merge stats
            primary.order_count += groups[j].order_count
            primary.total_spend += groups[j].total_spend

            // Update date range
            if (groups[j].first_order_date < primary.first_order_date) {
              primary.first_order_date = groups[j].first_order_date
            }
            if (groups[j].last_order_date > primary.last_order_date) {
              primary.last_order_date = groups[j].last_order_date
            }

            // Use primary's contact info if available, otherwise use merged group's
            if (!primary.contact_name && groups[j].contact_name) {
              primary.contact_name = groups[j].contact_name
            }
            if (!primary.contact_email && groups[j].contact_email) {
              primary.contact_email = groups[j].contact_email
            }
          }
        }

        processed.add(i)
        mergedGroups.push(primary)

        if (mergedNames.length > 0) {
          details.push({
            name: primary.company_name,
            orderCount: primary.order_count,
            totalSpend: primary.total_spend,
            mergedNames
          })
        }
      }
    }

    // Step 4: Check for existing customers and skip those
    const { data: existingCustomers, error: existingError } = await supabase
      .from('customers')
      .select('id, organization_id, name')

    if (existingError) {
      throw new Error(`Failed to fetch existing customers: ${existingError.message}`)
    }

    const existingCustomerMap = new Map<string, string>()
    for (const customer of existingCustomers || []) {
      const key = `${customer.organization_id}::${customer.name.toLowerCase().trim()}`
      existingCustomerMap.set(key, customer.id)
    }

    // Step 5: Create customers and link orders
    for (const group of mergedGroups) {
      const key = `${group.organization_id}::${group.company_name.toLowerCase().trim()}`

      // Check if customer already exists
      let customerId = existingCustomerMap.get(key)

      if (!customerId && !dryRun) {
        // Create new customer
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert({
            organization_id: group.organization_id,
            name: group.company_name,
            primary_contact_name: group.contact_name,
            primary_contact_email: group.contact_email,
            primary_contact_phone: group.phone,
            billing_address: group.billing_address,
            notes: 'Auto-created from order backfill',
            total_orders: group.order_count,
            total_spend: group.total_spend,
            average_order_value: group.order_count > 0 ? group.total_spend / group.order_count : null,
            first_order_date: group.first_order_date,
            last_order_date: group.last_order_date,
            is_active: true
          })
          .select('id')
          .single()

        if (createError) {
          // Check if it's a unique constraint violation (customer was created by another process)
          if (createError.code === '23505') {
            // Try to find the existing customer
            const { data: existing } = await supabase
              .from('customers')
              .select('id')
              .eq('organization_id', group.organization_id)
              .eq('name', group.company_name)
              .single()

            if (existing) {
              customerId = existing.id
            } else {
              errors.push(`Failed to create customer "${group.company_name}": ${createError.message}`)
              continue
            }
          } else {
            errors.push(`Failed to create customer "${group.company_name}": ${createError.message}`)
            continue
          }
        } else {
          customerId = newCustomer.id
          customersCreated++

          if (!details.find(d => d.name === group.company_name)) {
            details.push({
              name: group.company_name,
              orderCount: group.order_count,
              totalSpend: group.total_spend
            })
          }
        }
      }

      // Link orders to customer
      if (customerId && !dryRun) {
        const { error: linkError } = await supabase
          .from('orders')
          .update({
            customer_id: customerId,
            suggested_customer_id: null,
            suggested_customer_confidence: null
          })
          .in('id', group.order_ids)

        if (linkError) {
          errors.push(`Failed to link orders for "${group.company_name}": ${linkError.message}`)
        } else {
          ordersLinked += group.order_ids.length
        }
      } else if (dryRun) {
        ordersLinked += group.order_ids.length
      }
    }

    return {
      success: errors.length === 0,
      customersCreated,
      ordersLinked,
      duplicatesMerged,
      errors,
      details
    }

  } catch (error) {
    return {
      success: false,
      customersCreated,
      ordersLinked,
      duplicatesMerged,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}

/**
 * Dry run to preview what the backfill would do
 */
export async function previewCustomerBackfill(
  organizationId?: string
): Promise<BackfillResult> {
  return backfillCustomersFromOrders({
    organizationId,
    dryRun: true
  })
}
