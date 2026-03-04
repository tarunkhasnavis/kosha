/**
 * WooCommerce Integration Database Helpers
 *
 * Fetches WooCommerce config from organization_integrations table.
 */

import { createClient } from '@kosha/supabase/server'
import type { WooCommerceConfig, SkuMapping } from './types'

interface IntegrationRow {
  id: string
  organization_id: string
  type: string
  enabled: boolean
  config: {
    baseUrl: string
    orderNotificationEmail?: string
    skuMappings?: SkuMapping[]
  }
  credentials: {
    consumerKey: string
    consumerSecret: string
  }
}

/**
 * Get WooCommerce integration config for an organization
 * Returns null if not configured or disabled
 */
export async function getWooCommerceConfig(
  organizationId: string
): Promise<{ config: WooCommerceConfig; skuMappings: SkuMapping[] } | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_integrations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('type', 'woocommerce')
    .eq('enabled', true)
    .single()

  if (error || !data) {
    // No integration configured or disabled - this is normal
    return null
  }

  const row = data as IntegrationRow

  return {
    config: {
      baseUrl: row.config.baseUrl,
      consumerKey: row.credentials.consumerKey,
      consumerSecret: row.credentials.consumerSecret,
      orderNotificationEmail: row.config.orderNotificationEmail,
    },
    skuMappings: row.config.skuMappings || [],
  }
}

/**
 * Check if an organization has WooCommerce integration enabled
 */
export async function hasWooCommerceIntegration(
  organizationId: string
): Promise<boolean> {
  const config = await getWooCommerceConfig(organizationId)
  return config !== null
}
