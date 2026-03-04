/**
 * QuickBooks Online - Database Helpers
 *
 * Read/write QBO config and credentials from organization_integrations.
 * Follows the same pattern as WooCommerce db helpers.
 */

import { createClient } from '@kosha/supabase/server'
import { createServiceClient } from '@kosha/supabase/service'
import { encryptToken, decryptToken } from '@/lib/tokenEncryption'
import type { QBOConfig, QBOCredentials } from './types'

const INTEGRATION_TYPE = 'quickbooks_online'

/**
 * Get QBO config and decrypted credentials for an organization.
 */
export async function getQBOSettings(
  organizationId: string
): Promise<{ config: QBOConfig; credentials: QBOCredentials } | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organization_integrations')
    .select('config, credentials, enabled')
    .eq('organization_id', organizationId)
    .eq('type', INTEGRATION_TYPE)
    .single()

  if (error || !data) return null

  const config = data.config as unknown as QBOConfig
  const encryptedCreds = data.credentials as unknown as Record<string, string>

  if (!encryptedCreds?.accessToken || !encryptedCreds?.refreshToken) return null

  const credentials: QBOCredentials = {
    accessToken: decryptToken(encryptedCreds.accessToken),
    refreshToken: decryptToken(encryptedCreds.refreshToken),
    tokenExpiresAt: encryptedCreds.tokenExpiresAt,
    refreshTokenExpiresAt: encryptedCreds.refreshTokenExpiresAt,
  }

  return { config, credentials }
}

/**
 * Save QBO integration after OAuth callback.
 * Creates or updates the organization_integrations row.
 */
export async function saveQBOIntegration(
  organizationId: string,
  config: QBOConfig,
  credentials: {
    accessToken: string
    refreshToken: string
    expiresIn: number        // seconds
    refreshTokenExpiresIn: number  // seconds
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()

  const now = new Date()
  const tokenExpiresAt = new Date(now.getTime() + credentials.expiresIn * 1000).toISOString()
  const refreshTokenExpiresAt = new Date(now.getTime() + credentials.refreshTokenExpiresIn * 1000).toISOString()

  const encryptedCreds = {
    accessToken: encryptToken(credentials.accessToken),
    refreshToken: encryptToken(credentials.refreshToken),
    tokenExpiresAt,
    refreshTokenExpiresAt,
  }

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
        credentials: encryptedCreds,
        enabled: true,
        updated_at: now.toISOString(),
      })
      .eq('id', existing.id)

    if (error) {
      console.error('Failed to update QBO integration:', error)
      return { success: false, error: 'Failed to save integration' }
    }
  } else {
    const { error } = await supabase
      .from('organization_integrations')
      .insert({
        organization_id: organizationId,
        type: INTEGRATION_TYPE,
        config,
        credentials: encryptedCreds,
        enabled: true,
      })

    if (error) {
      console.error('Failed to create QBO integration:', error)
      return { success: false, error: 'Failed to save integration' }
    }
  }

  return { success: true }
}

/**
 * Find organization ID by QBO realmId.
 * Used by the webhook handler to resolve which org a notification belongs to.
 */
export async function getOrganizationByRealmId(
  realmId: string
): Promise<string | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('organization_integrations')
    .select('organization_id, config')
    .eq('type', INTEGRATION_TYPE)
    .eq('enabled', true)

  if (error || !data) return null

  // Find the integration whose config.realmId matches
  const match = data.find(row => {
    const config = row.config as unknown as QBOConfig
    return config?.realmId === realmId
  })

  return match?.organization_id || null
}

/**
 * Update only the OAuth tokens (after a refresh).
 */
export async function updateQBOTokens(
  organizationId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<void> {
  const supabase = createServiceClient()

  const now = new Date()
  const tokenExpiresAt = new Date(now.getTime() + expiresIn * 1000).toISOString()

  // Get existing credentials to preserve refreshTokenExpiresAt
  const { data: existing } = await supabase
    .from('organization_integrations')
    .select('credentials')
    .eq('organization_id', organizationId)
    .eq('type', INTEGRATION_TYPE)
    .single()

  const existingCreds = existing?.credentials as unknown as Record<string, string> | undefined

  const encryptedCreds = {
    accessToken: encryptToken(accessToken),
    refreshToken: encryptToken(refreshToken),
    tokenExpiresAt,
    refreshTokenExpiresAt: existingCreds?.refreshTokenExpiresAt || tokenExpiresAt,
  }

  await supabase
    .from('organization_integrations')
    .update({
      credentials: encryptedCreds,
      updated_at: now.toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('type', INTEGRATION_TYPE)
}
