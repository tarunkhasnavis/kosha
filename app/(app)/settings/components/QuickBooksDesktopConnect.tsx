'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Monitor } from 'lucide-react'

interface QuickBooksDesktopConnectProps {
  organizationId: string
}

/**
 * QBD-specific connection component.
 * Creates a Conductor auth session and opens the setup URL
 * where the user connects their QB Desktop via Web Connector.
 *
 * Unlike QBO (which redirects to Intuit OAuth in the same window),
 * this opens the Conductor auth flow URL. The user should open this
 * URL on the Windows machine where QB Desktop is installed.
 */
export function QuickBooksDesktopConnect({ organizationId }: QuickBooksDesktopConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [authFlowUrl, setAuthFlowUrl] = useState<string | null>(null)

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const response = await fetch('/api/integrations/quickbooks-desktop/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      })

      if (!response.ok) {
        throw new Error('Failed to initiate connection')
      }

      const { authFlowUrl: url } = await response.json()
      setAuthFlowUrl(url)

      // Open the auth flow in a new window (user may need to open on Windows machine)
      window.open(url, '_blank')
    } catch (error) {
      console.error('Failed to connect QBD:', error)
      setIsConnecting(false)
    }
  }

  if (authFlowUrl) {
    return (
      <div className="space-y-3">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 font-medium mb-1">
            Setup link generated
          </p>
          <p className="text-xs text-amber-700 mb-2">
            Open this link on the Windows computer where QuickBooks Desktop is installed.
            Follow the instructions to set up the Web Connector.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(authFlowUrl)
              }}
              className="text-xs"
            >
              Copy Link
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(authFlowUrl, '_blank')}
              className="text-xs"
            >
              Open Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      variant="outline"
      className="gap-2"
    >
      {isConnecting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Monitor className="h-4 w-4" />
      )}
      Connect QuickBooks Desktop
    </Button>
  )
}
