'use client'

import { useState } from 'react'
import { Button } from '@kosha/ui'
import { Loader2 } from 'lucide-react'

interface QuickBooksOnlineConnectProps {
  organizationId: string
}

/**
 * QBO-specific OAuth connection button.
 * Rendered inside ErpSettings when the user chooses to connect QBO.
 */
export function QuickBooksOnlineConnect({ organizationId }: QuickBooksOnlineConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      // Call API to get the OAuth URL (we don't build it client-side to keep secrets server-side)
      const response = await fetch('/api/integrations/quickbooks/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      })

      if (!response.ok) {
        throw new Error('Failed to initiate connection')
      }

      const { authUrl } = await response.json()
      // Redirect to Intuit OAuth
      window.location.href = authUrl
    } catch (error) {
      console.error('Failed to connect QBO:', error)
      setIsConnecting(false)
    }
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      className="gap-2"
    >
      {isConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
      Connect QuickBooks Online
    </Button>
  )
}
