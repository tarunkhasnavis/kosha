'use server'

/**
 * Generic ERP Server Actions
 *
 * UI-facing server actions for ERP operations. These are ERP-agnostic --
 * they resolve the correct provider via the registry and delegate to it.
 *
 * Usage from UI: import { syncCustomersFromErp } from '@/lib/integrations/actions'
 */

import { createClient } from '@kosha/supabase/server'
import { revalidatePath } from 'next/cache'
import { getOrganizationId } from '@/lib/organizations/queries'
import { getErpProvider } from './registry'
import { pullCustomersFromErp as pullCustomersSync, pushCustomerToErp as pushCustomerSync } from './sync/customers'
import { pullProductsFromErp as pullProductsSync } from './sync/products'
import { pushInvoiceToErp as pushInvoiceSync, pullInvoiceStatusFromErp as pullInvoiceStatusSync } from './sync/invoices'
import type { ErpConnectionInfo, ErpProviderType } from './types'

// ============================================
// Connection info
// ============================================

/**
 * Get ERP connection info for the current organization.
 * Used by ErpSettings UI to display connection status.
 */
export async function getErpConnectionInfo(): Promise<ErpConnectionInfo | null> {
  const organizationId = await getOrganizationId()
  if (!organizationId) return null

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_integrations')
    .select('type, enabled, config, created_at')
    .eq('organization_id', organizationId)
    .in('type', ['quickbooks_online', 'quickbooks_desktop', 'dynamics', 'netsuite'])
    .limit(1)

  if (error || !data || data.length === 0) return null

  const row = data[0]

  return {
    providerType: row.type as ErpProviderType,
    companyName: (row.config as Record<string, unknown>)?.companyName as string | null,
    enabled: row.enabled,
    connectedAt: row.created_at,
  }
}

// ============================================
// Connection management
// ============================================

/**
 * Disconnect the ERP integration for the current organization.
 */
export async function disconnectErp(): Promise<{ success: boolean; error?: string }> {
  const organizationId = await getOrganizationId()
  if (!organizationId) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('organization_integrations')
    .delete()
    .eq('organization_id', organizationId)
    .in('type', ['quickbooks_online', 'quickbooks_desktop', 'dynamics', 'netsuite'])

  if (error) {
    console.error('Failed to disconnect ERP:', error)
    return { success: false, error: 'Failed to disconnect' }
  }

  revalidatePath('/settings')
  return { success: true }
}

/**
 * Toggle ERP integration enabled/disabled.
 */
export async function toggleErpEnabled(
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const organizationId = await getOrganizationId()
  if (!organizationId) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('organization_integrations')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('organization_id', organizationId)
    .in('type', ['quickbooks_online', 'quickbooks_desktop', 'dynamics', 'netsuite'])

  if (error) {
    console.error('Failed to toggle ERP:', error)
    return { success: false, error: 'Failed to update' }
  }

  revalidatePath('/settings')
  return { success: true }
}

// ============================================
// Test connection
// ============================================

/**
 * Test the ERP connection for the current organization.
 */
export async function testErpConnection(): Promise<{
  success: boolean
  companyName?: string
  error?: string
}> {
  const organizationId = await getOrganizationId()
  if (!organizationId) return { success: false, error: 'Not authenticated' }

  const provider = await getErpProvider(organizationId)
  if (!provider) return { success: false, error: 'No ERP configured' }

  return provider.testConnection()
}

// ============================================
// Sync operations
// ============================================

/**
 * Pull customers from ERP into Kosha.
 */
export async function syncCustomersFromErp(): Promise<{
  success: boolean
  count?: number
  error?: string
}> {
  const organizationId = await getOrganizationId()
  if (!organizationId) return { success: false, error: 'Not authenticated' }

  try {
    const result = await pullCustomersSync(organizationId)
    const count = result.created + result.updated

    if (result.errors.length > 0) {
      console.error('Customer sync errors:', result.errors)
      return {
        success: count > 0,
        count,
        error: result.errors.length === 1 ? result.errors[0] : `${result.errors.length} errors during sync`,
      }
    }

    revalidatePath('/customers')
    return { success: true, count }
  } catch (error) {
    console.error('Customer sync failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Sync failed' }
  }
}

/**
 * Push a single customer to the ERP.
 */
export async function pushCustomerToErp(
  customerId: string
): Promise<{ success: boolean; error?: string }> {
  const organizationId = await getOrganizationId()
  if (!organizationId) return { success: false, error: 'Not authenticated' }

  try {
    const result = await pushCustomerSync(organizationId, customerId)
    if (result.success) {
      revalidatePath('/customers')
    }
    return result
  } catch (error) {
    console.error('Customer push failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Push failed' }
  }
}

/**
 * Bidirectional product sync: pull from ERP + push unlinked Kosha products to ERP.
 */
export async function syncProductsFromErp(): Promise<{
  success: boolean
  count?: number
  error?: string
}> {
  const organizationId = await getOrganizationId()
  if (!organizationId) return { success: false, error: 'Not authenticated' }

  try {
    const result = await pullProductsSync(organizationId)
    const count = result.created + result.updated + result.pushed

    if (result.errors.length > 0) {
      console.error('Product sync errors:', result.errors)
      return {
        success: count > 0,
        count,
        error: result.errors.length === 1 ? result.errors[0] : `${result.errors.length} errors during sync`,
      }
    }

    revalidatePath('/products')
    return { success: true, count }
  } catch (error) {
    console.error('Product sync failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Sync failed' }
  }
}

/**
 * Push an invoice to the ERP for a given order.
 * On success, the order transitions to 'invoiced'.
 */
export async function pushInvoiceToErp(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const organizationId = await getOrganizationId()
  if (!organizationId) return { success: false, error: 'Not authenticated' }

  try {
    const result = await pushInvoiceSync(organizationId, orderId)
    if (result.success) {
      revalidatePath('/orders')
      revalidatePath(`/orders/${orderId}`)
    }
    return result
  } catch (error) {
    console.error('Invoice push failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Push failed' }
  }
}

/**
 * Check the invoice status in the ERP for a given order.
 * If paid, auto-transitions the order to 'paid'.
 */
export async function checkInvoiceStatus(
  orderId: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  const organizationId = await getOrganizationId()
  if (!organizationId) return { success: false, error: 'Not authenticated' }

  try {
    const result = await pullInvoiceStatusSync(organizationId, orderId)
    if (result.success) {
      revalidatePath('/orders')
      revalidatePath(`/orders/${orderId}`)
    }
    return result
  } catch (error) {
    console.error('Invoice status check failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Status check failed' }
  }
}
