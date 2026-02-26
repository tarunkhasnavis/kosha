/**
 * QuickBooks Desktop - Database Helpers
 *
 * Read/write QBD config from organization_integrations.
 * Follows the same pattern as QBO db.ts, but simpler:
 * - No encrypted credentials (Conductor manages auth)
 * - Config just stores conductorEndUserId + companyName
 */

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import type { QBDConfig } from './types'

const INTEGRATION_TYPE = 'quickbooks_desktop'

/**
 * Get QBD config for an organization.
 */
export async function getQBDSettings(
  organizationId: string
): Promise<QBDConfig | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_integrations')
    .select('config, enabled')
    .eq('organization_id', organizationId)
    .eq('type', INTEGRATION_TYPE)
    .single()

  if (error || !data) return null

  return data.config as unknown as QBDConfig
}

/**
 * Save QBD integration after Conductor auth flow completes.
 * Creates or updates the organization_integrations row.
 */
export async function saveQBDIntegration(
  organizationId: string,
  config: QBDConfig
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()

  const now = new Date().toISOString()

  // Check if integration already exists
  const { data: existing } = await supabase
    .from('organization_integrations')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('type', INTEGRATION_TYPE)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('organization_integrations')
      .update({
        config,
        enabled: true,
        updated_at: now,
      })
      .eq('id', existing.id)

    if (error) {
      console.error('Failed to update QBD integration:', error)
      return { success: false, error: 'Failed to save integration' }
    }
  } else {
    const { error } = await supabase
      .from('organization_integrations')
      .insert({
        organization_id: organizationId,
        type: INTEGRATION_TYPE,
        config,
        credentials: {},  // No credentials needed — Conductor manages auth
        enabled: true,
      })

    if (error) {
      console.error('Failed to create QBD integration:', error)
      return { success: false, error: 'Failed to save integration' }
    }
  }

  return { success: true }
}

/**
 * Get QBD config using the service client (for server-side operations).
 * Bypasses RLS — use only in server actions, webhooks, etc.
 */
export async function getQBDSettingsService(
  organizationId: string
): Promise<QBDConfig | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('organization_integrations')
    .select('config')
    .eq('organization_id', organizationId)
    .eq('type', INTEGRATION_TYPE)
    .eq('enabled', true)
    .single()

  if (error || !data) return null

  return data.config as unknown as QBDConfig
}
