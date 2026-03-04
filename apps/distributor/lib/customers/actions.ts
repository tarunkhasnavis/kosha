'use server'

/**
 * Customer Server Actions
 *
 * CRUD operations for customer management.
 * Mutations only - read operations are in queries.ts
 */

import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/organizations/queries'
import { revalidatePath } from 'next/cache'
import { countCustomerOrders } from './queries'
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from '@kosha/types'

/**
 * Create a new customer
 */
export async function createCustomer(
  input: CreateCustomerInput
): Promise<{ customer: Customer | null; error?: string }> {
  const user = await getUser()
  if (!user) {
    return { customer: null, error: 'Not authenticated' }
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return { customer: null, error: 'No organization found' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .insert({
      organization_id: orgId,
      name: input.name.trim(),
      customer_number: input.customer_number?.trim() || null,
      primary_contact_name: input.primary_contact_name?.trim() || null,
      primary_contact_email: input.primary_contact_email?.trim().toLowerCase() || null,
      primary_contact_phone: input.primary_contact_phone?.trim() || null,
      billing_address: input.billing_address || null,
      shipping_address: input.shipping_address || null,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create customer:', error)
    if (error.code === '23505') {
      if (error.message?.includes('unique_customer_name_per_org')) {
        return { customer: null, error: 'A customer with this name already exists' }
      }
      if (error.message?.includes('unique_customer_number_per_org')) {
        return { customer: null, error: 'A customer with this number already exists' }
      }
      return { customer: null, error: 'A customer with these details already exists' }
    }
    return { customer: null, error: 'Failed to create customer' }
  }

  revalidatePath('/customers')
  return { customer: data }
}

/**
 * Update an existing customer
 */
export async function updateCustomer(
  customerId: string,
  input: UpdateCustomerInput
): Promise<{ customer: Customer | null; error?: string }> {
  const user = await getUser()
  if (!user) {
    return { customer: null, error: 'Not authenticated' }
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return { customer: null, error: 'No organization found' }
  }

  const supabase = await createClient()

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {}
  if (input.name !== undefined) updateData.name = input.name.trim()
  if (input.customer_number !== undefined) updateData.customer_number = input.customer_number?.trim() || null
  if (input.primary_contact_name !== undefined) updateData.primary_contact_name = input.primary_contact_name?.trim() || null
  if (input.primary_contact_email !== undefined) updateData.primary_contact_email = input.primary_contact_email?.trim().toLowerCase() || null
  if (input.primary_contact_phone !== undefined) updateData.primary_contact_phone = input.primary_contact_phone?.trim() || null
  if (input.billing_address !== undefined) updateData.billing_address = input.billing_address
  if (input.shipping_address !== undefined) updateData.shipping_address = input.shipping_address
  if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null
  if (input.is_active !== undefined) updateData.is_active = input.is_active

  const { data, error } = await supabase
    .from('customers')
    .update(updateData)
    .eq('id', customerId)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update customer:', error)
    if (error.code === '23505') {
      if (error.message?.includes('unique_customer_name_per_org')) {
        return { customer: null, error: 'A customer with this name already exists' }
      }
      if (error.message?.includes('unique_customer_number_per_org')) {
        return { customer: null, error: 'A customer with this number already exists' }
      }
      return { customer: null, error: 'A customer with these details already exists' }
    }
    return { customer: null, error: 'Failed to update customer' }
  }

  revalidatePath('/customers')
  revalidatePath(`/customers/${customerId}`)
  return { customer: data }
}

/**
 * Delete a customer (soft delete by setting is_active = false)
 *
 * Customers with orders cannot be hard deleted - they are deactivated instead.
 * This preserves referential integrity with historical orders.
 */
export async function deleteCustomer(
  customerId: string
): Promise<{ success: boolean; error?: string; deactivated?: boolean }> {
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return { success: false, error: 'No organization found' }
  }

  // Check if customer has orders
  const orderCount = await countCustomerOrders(customerId)

  const supabase = await createClient()

  if (orderCount > 0) {
    // Soft delete - deactivate the customer
    const { error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', customerId)
      .eq('organization_id', orgId)

    if (error) {
      console.error('Failed to deactivate customer:', error)
      return { success: false, error: 'Failed to deactivate customer' }
    }

    revalidatePath('/customers')
    return { success: true, deactivated: true }
  }

  // Hard delete - customer has no orders
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId)
    .eq('organization_id', orgId)

  if (error) {
    console.error('Failed to delete customer:', error)
    return { success: false, error: 'Failed to delete customer' }
  }

  revalidatePath('/customers')
  return { success: true }
}

/**
 * Reactivate a deactivated customer
 */
export async function reactivateCustomer(
  customerId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await updateCustomer(customerId, { is_active: true })
  return { success: result.customer !== null, error: result.error }
}

/**
 * Link an order to a customer
 *
 * This is called when the user confirms a customer selection in the order review UI.
 * It sets the customer_id FK on the order (which was previously null).
 */
export async function setOrderCustomer(
  orderId: string,
  customerId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return { success: false, error: 'No organization found' }
  }

  const supabase = await createClient()

  // Verify the customer belongs to this organization
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .single()

  if (customerError || !customer) {
    return { success: false, error: 'Customer not found or inactive' }
  }

  // Update the order with the confirmed customer
  const { error } = await supabase
    .from('orders')
    .update({
      customer_id: customerId,
      // Clear the suggestion fields since user has confirmed
      suggested_customer_id: null,
      suggested_customer_confidence: null,
    })
    .eq('id', orderId)
    .eq('organization_id', orgId)

  if (error) {
    console.error('Failed to link customer to order:', error)
    return { success: false, error: 'Failed to link customer to order' }
  }

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}

/**
 * Unlink a customer from an order
 *
 * This clears the customer_id FK, allowing the user to select a different customer.
 */
export async function unlinkOrderCustomer(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return { success: false, error: 'No organization found' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update({ customer_id: null })
    .eq('id', orderId)
    .eq('organization_id', orgId)

  if (error) {
    console.error('Failed to unlink customer from order:', error)
    return { success: false, error: 'Failed to unlink customer from order' }
  }

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}

/**
 * Create a customer and immediately link to an order
 *
 * This is used when creating a new customer from the order review UI.
 * Combines createCustomer + setOrderCustomer in a single action.
 */
export async function createCustomerAndLinkToOrder(
  input: CreateCustomerInput,
  orderId: string
): Promise<{ customer: Customer | null; error?: string }> {
  // Create the customer first
  const createResult = await createCustomer(input)

  if (!createResult.customer) {
    return createResult
  }

  // Link to the order
  const linkResult = await setOrderCustomer(orderId, createResult.customer.id)

  if (!linkResult.success) {
    // Customer was created but linking failed - still return the customer
    // The user can manually link it
    console.error('Customer created but failed to link to order:', linkResult.error)
  }

  return createResult
}

/**
 * Get orders for a customer (server action wrapper)
 *
 * This is a server action wrapper around the query function,
 * allowing it to be called from client components.
 */
export async function fetchCustomerOrders(
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
 * Search customers (server action wrapper)
 *
 * This is a server action wrapper around the query function,
 * allowing it to be called from client components.
 */
export async function fetchCustomers(
  search?: string,
  limit: number = 50
): Promise<{
  customers: Customer[]
  error?: string
}> {
  const orgId = await getOrganizationId()

  if (!orgId) {
    return { customers: [], error: 'No organization found' }
  }

  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name')
    .limit(limit)

  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`
    query = query.or(`name.ilike.${searchTerm},primary_contact_email.ilike.${searchTerm},customer_number.ilike.${searchTerm}`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch customers:', error)
    return { customers: [], error: 'Failed to fetch customers' }
  }

  return { customers: data || [] }
}

/**
 * Get a single customer by ID (server action wrapper)
 */
export async function fetchCustomer(
  customerId: string
): Promise<{
  customer: Customer | null
  error?: string
}> {
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
