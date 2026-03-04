'use client'

import { createClient } from '@kosha/supabase/client'
import { Button } from '@kosha/ui'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useState } from 'react'

export function GmailReconnectBanner() {
  const [isLoading, setIsLoading] = useState(false)

  const handleReconnect = async () => {
    setIsLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes:
          'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    if (error) {
      console.error('Error reconnecting Gmail:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Gmail connection lost. Orders from email won&apos;t be processed
            until you reconnect.
          </p>
        </div>
        <Button
          onClick={handleReconnect}
          disabled={isLoading}
          size="sm"
          variant="outline"
          className="shrink-0 border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Reconnect Gmail
        </Button>
      </div>
    </div>
  )
}
