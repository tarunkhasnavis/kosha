'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Building2,
  Loader2,
  Trash2,
  RefreshCw,
  Pencil,
} from 'lucide-react'
import {
  getErpConnectionInfo,
  disconnectErp,
  toggleErpEnabled,
  testErpConnection,
  syncCustomersFromErp,
  syncProductsFromErp,
} from '@/lib/integrations/actions'
import type { ErpConnectionInfo } from '@/lib/integrations/types'
import { QuickBooksOnlineConnect } from './QuickBooksOnlineConnect'
import { QuickBooksDesktopConnect } from './QuickBooksDesktopConnect'

interface ErpSettingsProps {
  organizationId: string
}

const PROVIDER_LABELS: Record<string, string> = {
  quickbooks_online: 'QuickBooks Online',
  quickbooks_desktop: 'QuickBooks Desktop',
  dynamics: 'Microsoft Dynamics',
  netsuite: 'NetSuite',
}

export function ErpSettings({ organizationId }: ErpSettingsProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [connection, setConnection] = useState<ErpConnectionInfo | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isSyncingCustomers, setIsSyncingCustomers] = useState(false)
  const [isSyncingProducts, setIsSyncingProducts] = useState(false)

  // Load connection info
  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const info = await getErpConnectionInfo()
      setConnection(info)
      setIsLoading(false)
    }
    load()
  }, [])

  // Check URL for QBO OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('qbo_connected') === 'true') {
      toast({
        title: 'QuickBooks connected',
        description: 'Your QuickBooks Online account has been linked',
      })
      getErpConnectionInfo().then(setConnection)
      window.history.replaceState({}, '', '/settings')
    }
    if (params.get('qbd_connected') === 'true') {
      toast({
        title: 'QuickBooks Desktop connected',
        description: 'Your QuickBooks Desktop has been linked via Web Connector',
      })
      getErpConnectionInfo().then(setConnection)
      window.history.replaceState({}, '', '/settings')
    }
    const qboError = params.get('qbo_error')
    if (qboError) {
      toast({
        title: 'Connection failed',
        description: qboError === 'access_denied'
          ? 'You denied access to QuickBooks'
          : 'Failed to connect to QuickBooks. Please try again.',
        variant: 'destructive',
      })
      window.history.replaceState({}, '', '/settings')
    }
  }, [toast])

  const handleTest = async () => {
    setIsTesting(true)
    const result = await testErpConnection()
    setIsTesting(false)

    if (result.success) {
      toast({
        title: 'Connection successful',
        description: `Connected to ${result.companyName || 'ERP'}`,
      })
    } else {
      toast({
        title: 'Connection failed',
        description: result.error || 'Could not connect',
        variant: 'destructive',
      })
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect the ERP integration?')) return

    setIsDisconnecting(true)
    const result = await disconnectErp()
    setIsDisconnecting(false)

    if (result.success) {
      setConnection(null)
      toast({ title: 'Disconnected', description: 'ERP integration has been removed' })
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to disconnect',
        variant: 'destructive',
      })
    }
  }

  const handleToggleEnabled = async (checked: boolean) => {
    if (!connection) return
    setConnection({ ...connection, enabled: checked })

    const result = await toggleErpEnabled(checked)
    if (result.success) {
      toast({
        title: checked ? 'Integration enabled' : 'Integration disabled',
        description: checked ? 'ERP sync is now active' : 'ERP sync is paused',
      })
    } else {
      setConnection({ ...connection, enabled: !checked })
      toast({
        title: 'Error',
        description: result.error || 'Failed to update',
        variant: 'destructive',
      })
    }
  }

  const handleSyncCustomers = async () => {
    setIsSyncingCustomers(true)
    const result = await syncCustomersFromErp()
    setIsSyncingCustomers(false)

    if (result.success) {
      toast({ title: 'Customers synced', description: `${result.count || 0} customers updated` })
    } else {
      toast({
        title: 'Sync failed',
        description: result.error || 'Failed to sync customers',
        variant: 'destructive',
      })
    }
  }

  const handleSyncProducts = async () => {
    setIsSyncingProducts(true)
    const result = await syncProductsFromErp()
    setIsSyncingProducts(false)

    if (result.success) {
      toast({ title: 'Products synced', description: `${result.count || 0} products updated` })
    } else {
      toast({
        title: 'Sync failed',
        description: result.error || 'Failed to sync products',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        </CardContent>
      </Card>
    )
  }

  // Not connected -- show available ERPs to connect
  if (!connection) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">ERP / Accounting</CardTitle>
              <CardDescription>
                Connect your accounting software for invoice and inventory sync
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Choose an ERP to connect:
            </p>
            <div className="flex flex-wrap gap-3">
              <QuickBooksOnlineConnect organizationId={organizationId} />
              <QuickBooksDesktopConnect organizationId={organizationId} />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Connected -- show status, sync buttons, disconnect
  const providerLabel = PROVIDER_LABELS[connection.providerType] || connection.providerType

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">{providerLabel}</CardTitle>
              <CardDescription>
                {connection.companyName || 'Connected'}
              </CardDescription>
            </div>
          </div>
          <Badge variant={connection.enabled ? 'default' : 'secondary'}>
            {connection.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection details */}
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-muted-foreground">Provider</span>
            <span className="text-sm font-medium">{providerLabel}</span>
          </div>
          {connection.companyName && (
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-sm text-muted-foreground">Company</span>
              <span className="text-sm font-medium">{connection.companyName}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-muted-foreground">Integration Status</span>
            <Switch
              checked={connection.enabled}
              onCheckedChange={handleToggleEnabled}
            />
          </div>
        </div>

        {/* Sync actions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-700">Manual Sync</h4>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncCustomers}
              disabled={isSyncingCustomers || !connection.enabled}
              className="gap-1.5"
            >
              {isSyncingCustomers ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sync Customers
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncProducts}
              disabled={isSyncingProducts || !connection.enabled}
              className="gap-1.5"
            >
              {isSyncingProducts ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sync Products
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isTesting}
              className="gap-1.5"
            >
              {isTesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
              Test Connection
            </Button>
          </div>
        </div>

        {/* Disconnect */}
        <div className="pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {isDisconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
