'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  ShoppingCart,
  Loader2,
  Check,
  X,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import {
  getWooCommerceSettings,
  saveWooCommerceSettings,
  testWooCommerceConnection,
  deleteWooCommerceIntegration,
  type WooCommerceSettingsData,
} from '@/lib/integrations/woocommerce/actions'

interface WooCommerceSettingsProps {
  organizationId: string
}

export function WooCommerceSettings({ organizationId }: WooCommerceSettingsProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)
  const [hasExisting, setHasExisting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'success' | 'error'>('none')

  const [formData, setFormData] = useState({
    baseUrl: '',
    consumerKey: '',
    consumerSecret: '',
    enabled: true,
  })

  // Load existing settings
  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true)
      const settings = await getWooCommerceSettings(organizationId)
      if (settings) {
        setFormData(settings)
        setHasExisting(true)
      }
      setIsLoading(false)
    }
    loadSettings()
  }, [organizationId])

  const handleSave = async () => {
    if (!formData.baseUrl || !formData.consumerKey || !formData.consumerSecret) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    const result = await saveWooCommerceSettings(organizationId, formData)
    setIsSaving(false)

    if (result.success) {
      setHasExisting(true)
      toast({
        title: 'Settings saved',
        description: 'WooCommerce integration has been configured',
      })
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to save settings',
        variant: 'destructive',
      })
    }
  }

  const handleTest = async () => {
    if (!formData.baseUrl || !formData.consumerKey || !formData.consumerSecret) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all fields before testing',
        variant: 'destructive',
      })
      return
    }

    setIsTesting(true)
    setConnectionStatus('none')

    const result = await testWooCommerceConnection(
      formData.baseUrl,
      formData.consumerKey,
      formData.consumerSecret
    )

    setIsTesting(false)

    if (result.success) {
      setConnectionStatus('success')
      toast({
        title: 'Connection successful',
        description: `Connected to ${result.storeName || formData.baseUrl}`,
      })
    } else {
      setConnectionStatus('error')
      toast({
        title: 'Connection failed',
        description: result.error || 'Could not connect to WooCommerce',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove the WooCommerce integration?')) {
      return
    }

    setIsDeleting(true)
    const result = await deleteWooCommerceIntegration(organizationId)
    setIsDeleting(false)

    if (result.success) {
      setFormData({
        baseUrl: '',
        consumerKey: '',
        consumerSecret: '',
        enabled: true,
      })
      setHasExisting(false)
      setConnectionStatus('none')
      toast({
        title: 'Integration removed',
        description: 'WooCommerce integration has been deleted',
      })
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to delete integration',
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-base">WooCommerce</CardTitle>
              <CardDescription>
                Sync inventory when orders are completed
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasExisting && (
              <Badge variant={formData.enabled ? 'default' : 'secondary'}>
                {formData.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Store URL */}
        <div className="space-y-2">
          <Label htmlFor="baseUrl">Store URL</Label>
          <Input
            id="baseUrl"
            type="url"
            placeholder="https://your-store.com"
            value={formData.baseUrl}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Your WooCommerce store URL (e.g., https://mystore.com)
          </p>
        </div>

        {/* Consumer Key */}
        <div className="space-y-2">
          <Label htmlFor="consumerKey">Consumer Key</Label>
          <Input
            id="consumerKey"
            type={showSecrets ? 'text' : 'password'}
            placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={formData.consumerKey}
            onChange={(e) => setFormData({ ...formData, consumerKey: e.target.value })}
          />
        </div>

        {/* Consumer Secret */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="consumerSecret">Consumer Secret</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowSecrets(!showSecrets)}
              className="h-auto py-1 px-2 text-xs"
            >
              {showSecrets ? (
                <>
                  <EyeOff className="h-3 w-3 mr-1" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  Show
                </>
              )}
            </Button>
          </div>
          <Input
            id="consumerSecret"
            type={showSecrets ? 'text' : 'password'}
            placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={formData.consumerSecret}
            onChange={(e) => setFormData({ ...formData, consumerSecret: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Generate API keys in WooCommerce → Settings → Advanced → REST API.{' '}
            <a
              href="https://woocommerce.com/document/woocommerce-rest-api/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              Learn more <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        {/* Enable/Disable Toggle */}
        {hasExisting && (
          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Enable Integration</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, stock will sync on order completion
              </p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </div>
        )}

        {/* Connection Status */}
        {connectionStatus !== 'none' && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg ${
              connectionStatus === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {connectionStatus === 'success' ? (
              <>
                <Check className="h-4 w-4" />
                Connection successful
              </>
            ) : (
              <>
                <X className="h-4 w-4" />
                Connection failed
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            {hasExisting && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Remove
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={isTesting || !formData.baseUrl}
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
