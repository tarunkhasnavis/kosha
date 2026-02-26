/**
 * ERP Provider Registry
 *
 * Resolves the correct ErpProvider implementation based on an organization's
 * configured integration type. Sync orchestration and UI call this instead
 * of importing provider-specific code directly.
 *
 * To add a new provider:
 * 1. Create lib/integrations/providers/<name>/provider.ts implementing ErpProvider
 * 2. Register it in the switch statement below
 */

import { createClient } from '@/utils/supabase/server'
import type { ErpProvider, ErpProviderType } from './types'

/**
 * Get the ERP provider for an organization, or null if none is configured.
 */
export async function getErpProvider(organizationId: string): Promise<ErpProvider | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_integrations')
    .select('type, enabled')
    .eq('organization_id', organizationId)
    .in('type', ['quickbooks_online', 'quickbooks_desktop', 'dynamics', 'netsuite'])
    .eq('enabled', true)
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return resolveProvider(organizationId, data.type as ErpProviderType)
}

/**
 * Resolve a specific provider by type.
 * Lazy-imports the provider module to keep bundle size small.
 */
async function resolveProvider(
  organizationId: string,
  type: ErpProviderType
): Promise<ErpProvider | null> {
  switch (type) {
    case 'quickbooks_online': {
      const { createQBOProvider } = await import('./providers/quickbooks-online/provider')
      return createQBOProvider(organizationId)
    }
    case 'quickbooks_desktop': {
      const { createQBDesktopProvider } = await import('./providers/quickbooks-desktop/provider')
      const { getQBDSettings } = await import('./providers/quickbooks-desktop/db')
      const qbdSettings = await getQBDSettings(organizationId)
      if (!qbdSettings) return null
      return createQBDesktopProvider(qbdSettings.conductorEndUserId)
    }
    default:
      console.warn(`Unknown ERP provider type: ${type}`)
      return null
  }
}
