import { createClient } from '@/utils/supabase/server'
import { getOrganizationId } from '@/lib/organizations/queries'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import { WooCommerceSettings } from './components/WooCommerceSettings'
import { CustomFieldsSettings } from './components/CustomFieldsSettings'
import { OrganizationInfoSettings } from './components/OrganizationInfoSettings'
import { getOrgRequiredFields } from '@/lib/orders/field-config'

// Note: Card and CardContent are still used in the "No Organization Found" error state

interface OrganizationData {
  id: string
  name: string
  gmail_email: string | null
  address: string | null
  phone: string | null
  created_at: string
  required_order_fields: unknown
}

async function getOrganizationData(orgId: string): Promise<OrganizationData | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, gmail_email, address, phone, created_at, required_order_fields')
    .eq('id', orgId)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

export default async function SettingsPage() {
  const orgId = await getOrganizationId()

  if (!orgId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 pb-6 text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-orange-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No Organization Found</h2>
            <p className="text-muted-foreground">
              You need to be part of an organization to access settings.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const org = await getOrganizationData(orgId)

  if (!org) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Failed to load organization info.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 ml-64">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your organization and integrations
            </p>
          </div>

          {/* Account Section */}
          <section>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Account</h2>
            <OrganizationInfoSettings
              organizationId={orgId}
              name={org.name}
              gmailEmail={org.gmail_email}
              address={org.address}
              phone={org.phone}
              createdAt={org.created_at}
            />
          </section>

          {/* Order Configuration Section */}
          <section>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Order Configuration</h2>
            <CustomFieldsSettings
              organizationId={orgId}
              initialFields={getOrgRequiredFields(org.required_order_fields)}
            />
          </section>

          {/* Integrations Section */}
          <section>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Integrations</h2>
            <WooCommerceSettings organizationId={orgId} />
          </section>
        </div>
      </div>
    </div>
  )
}
