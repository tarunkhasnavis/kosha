'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface WooCommerceSettingsData {
  baseUrl: string
  consumerKey: string
  consumerSecret: string
  enabled: boolean
}

export interface WooCommerceSettingsResult {
  success: boolean
  error?: string
}

/**
 * Get WooCommerce settings for an organization
 */
export async function getWooCommerceSettings(
  organizationId: string
): Promise<WooCommerceSettingsData | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_integrations')
    .select('config, credentials, enabled')
    .eq('organization_id', organizationId)
    .eq('type', 'woocommerce')
    .single()

  if (error || !data) {
    return null
  }

  return {
    baseUrl: data.config?.baseUrl || '',
    consumerKey: data.credentials?.consumerKey || '',
    consumerSecret: data.credentials?.consumerSecret || '',
    enabled: data.enabled,
  }
}

/**
 * Save WooCommerce settings for an organization
 */
export async function saveWooCommerceSettings(
  organizationId: string,
  settings: {
    baseUrl: string
    consumerKey: string
    consumerSecret: string
    enabled: boolean
  }
): Promise<WooCommerceSettingsResult> {
  const supabase = await createClient()

  // Validate URL format
  try {
    new URL(settings.baseUrl)
  } catch {
    return { success: false, error: 'Invalid store URL format' }
  }

  // Check if integration already exists
  const { data: existing } = await supabase
    .from('organization_integrations')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('type', 'woocommerce')
    .single()

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('organization_integrations')
      .update({
        config: { baseUrl: settings.baseUrl },
        credentials: {
          consumerKey: settings.consumerKey,
          consumerSecret: settings.consumerSecret,
        },
        enabled: settings.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) {
      console.error('Failed to update WooCommerce settings:', error)
      return { success: false, error: 'Failed to save settings' }
    }
  } else {
    // Insert new
    const { error } = await supabase.from('organization_integrations').insert({
      organization_id: organizationId,
      type: 'woocommerce',
      config: { baseUrl: settings.baseUrl },
      credentials: {
        consumerKey: settings.consumerKey,
        consumerSecret: settings.consumerSecret,
      },
      enabled: settings.enabled,
    })

    if (error) {
      console.error('Failed to create WooCommerce settings:', error)
      return { success: false, error: 'Failed to save settings' }
    }
  }

  revalidatePath('/settings')
  return { success: true }
}

/**
 * Test WooCommerce connection
 */
export async function testWooCommerceConnection(
  baseUrl: string,
  consumerKey: string,
  consumerSecret: string
): Promise<{ success: boolean; error?: string; storeName?: string }> {
  try {
    // Normalize URL
    const url = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

    // Try to fetch store info
    const response = await fetch(`${url}/wp-json/wc/v3/system_status`, {
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64'),
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Invalid API credentials' }
      }
      if (response.status === 404) {
        return { success: false, error: 'WooCommerce API not found at this URL' }
      }
      return { success: false, error: `Connection failed: ${response.status}` }
    }

    const data = await response.json()
    const storeName = data.environment?.site_url || baseUrl

    return { success: true, storeName }
  } catch (error) {
    console.error('WooCommerce connection test failed:', error)
    return { success: false, error: 'Failed to connect to store' }
  }
}

/**
 * Delete WooCommerce integration
 */
export async function deleteWooCommerceIntegration(
  organizationId: string
): Promise<WooCommerceSettingsResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('organization_integrations')
    .delete()
    .eq('organization_id', organizationId)
    .eq('type', 'woocommerce')

  if (error) {
    console.error('Failed to delete WooCommerce integration:', error)
    return { success: false, error: 'Failed to delete integration' }
  }

  revalidatePath('/settings')
  return { success: true }
}
