/**
 * QuickBooks Desktop - Specific Types
 *
 * Config stored in organization_integrations.
 * API response types come directly from the conductor-node SDK
 * (e.g., Qbd.Customer, Qbd.InventoryItem, Qbd.Invoice),
 * so we only define our config shape here.
 *
 * Unlike QBO (which uses OAuth), QBD auth is managed by Conductor:
 * - One API key for the app (CONDUCTOR_SECRET_KEY)
 * - A conductorEndUserId per organization (identifies their QB Desktop company file)
 */

// ============================================
// Config (stored in organization_integrations)
// ============================================

export interface QBDConfig {
  conductorEndUserId: string   // Conductor's end user ID (end_usr_...)
  companyName: string          // Company name from QB Desktop
}

// No credentials needed — Conductor manages the connection.
// The CONDUCTOR_SECRET_KEY is an app-level env var, not per-org.
