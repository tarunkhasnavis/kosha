/**
 * Customer Queries
 *
 * Read-only database operations for customers.
 * No mutations - those are in actions.ts
 */

import { createClient } from '@kosha/supabase/server'
import { getOrganizationId } from '@/lib/organizations/queries'
import type { Customer, CustomerFilters } from '@kosha/types'

/**
 * Get all customers for the current organization
 */
export async function getCustomers(
  filters?: CustomerFilters
): Promise<{ customers: Customer[]; error?: string }> {
  const orgId = await getOrganizationId()

  if (!orgId) {
    return { customers: [], error: 'No organization found' }
  }

  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select('*')
    .eq('organization_id', orgId)

  // Apply filters
  if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive)
  }

  if (filters?.hasErpLink !== undefined) {
    if (filters.hasErpLink) {
      query = query.not('erp_entity_id', 'is', null)
    } else {
      query = query.is('erp_entity_id', null)
    }
  }

  if (filters?.search) {
    const searchTerm = filters.search.trim().toLowerCase()
    query = query.or(
      `name.ilike.%${searchTerm}%,primary_contact_email.ilike.%${searchTerm}%,primary_contact_name.ilike.%${searchTerm}%,customer_number.ilike.%${searchTerm}%`
    )
  }

  // Apply sorting
  const sortBy = filters?.sortBy || 'name'
  const sortOrder = filters?.sortOrder || 'asc'
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch customers:', error)
    return { customers: [], error: 'Failed to fetch customers' }
  }

  return { customers: data || [] }
}

/**
 * Get a single customer by ID
 */
export async function getCustomer(
  customerId: string
): Promise<{ customer: Customer | null; error?: string }> {
  const orgId = await getOrganizationId()

  if (!orgId) {
    return { customer: null, error: 'No organization found' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('organization_id', orgId)
    .single()

  if (error) {
    console.error('Failed to fetch customer:', error)
    return { customer: null, error: 'Failed to fetch customer' }
  }

  return { customer: data }
}

/**
 * Search customers by name or email
 */
export async function searchCustomers(
  query: string,
  limit: number = 10
): Promise<{ customers: Customer[]; error?: string }> {
  const orgId = await getOrganizationId()

  if (!orgId) {
    return { customers: [], error: 'No organization found' }
  }

  const supabase = await createClient()
  const searchTerm = query.trim().toLowerCase()

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .or(
      `name.ilike.%${searchTerm}%,primary_contact_email.ilike.%${searchTerm}%,primary_contact_name.ilike.%${searchTerm}%`
    )
    .order('name', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Failed to search customers:', error)
    return { customers: [], error: 'Failed to search customers' }
  }

  return { customers: data || [] }
}

/**
 * Get customer by exact email match
 */
export async function getCustomerByEmail(
  email: string
): Promise<Customer | null> {
  const orgId = await getOrganizationId()

  if (!orgId || !email) {
    return null
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .ilike('primary_contact_email', email.trim())
    .single()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Get customer by exact name match (case-insensitive)
 */
export async function getCustomerByName(
  name: string
): Promise<Customer | null> {
  const orgId = await getOrganizationId()

  if (!orgId || !name) {
    return null
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .ilike('name', name.trim())
    .single()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Get orders for a customer
 */
export async function getCustomerOrders(
  customerId: string,
  limit: number = 10
): Promise<{
  orders: Array<{
    id: string
    order_number: string
    received_date: string
    status: string
    order_value: number
    item_count: number
  }>
  error?: string
}> {
  const orgId = await getOrganizationId()

  if (!orgId) {
    return { orders: [], error: 'No organization found' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, received_date, status, order_value, item_count')
    .eq('customer_id', customerId)
    .eq('organization_id', orgId)
    .order('received_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch customer orders:', error)
    return { orders: [], error: 'Failed to fetch customer orders' }
  }

  return { orders: data || [] }
}

/**
 * Count orders for a customer (used before deletion)
 */
export async function countCustomerOrders(customerId: string): Promise<number> {
  const orgId = await getOrganizationId()

  if (!orgId) {
    return 0
  }

  const supabase = await createClient()

  const { count, error } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('organization_id', orgId)

  if (error) {
    console.error('Failed to count customer orders:', error)
    return 0
  }

  return count || 0
}

/**
 * Get all active customers for matching (used by matching.ts)
 * Returns minimal fields for performance
 */
export async function getCustomersForMatching(): Promise<
  Array<{
    id: string
    name: string
    primary_contact_email: string | null
  }>
> {
  const orgId = await getOrganizationId()

  if (!orgId) {
    return []
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, primary_contact_email')
    .eq('organization_id', orgId)
    .eq('is_active', true)

  if (error) {
    console.error('Failed to fetch customers for matching:', error)
    return []
  }

  return data || []
}
