import { getOrganizationId } from '@/lib/organizations/queries'
import { getCustomers } from '@/lib/customers/queries'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'
import { CustomersList } from './components/CustomersList'

export default async function CustomersPage() {
  const orgId = await getOrganizationId()

  if (!orgId) {
    return (
      <div className="flex min-h-screen bg-[#F7F8FA]">
        <main className="flex-1 overflow-y-auto pl-60">
          <div className="w-full px-6 lg:px-8 py-8 flex items-center justify-center min-h-[calc(100vh-4rem)]">
            <Card className="max-w-md">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="flex justify-center mb-4">
                  <AlertCircle className="h-12 w-12 text-orange-500" />
                </div>
                <h2 className="text-xl font-semibold mb-2">No Organization Found</h2>
                <p className="text-slate-500">
                  You need to be part of an organization to view customers.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  const { customers, error } = await getCustomers()

  if (error) {
    console.error('Failed to fetch customers:', error)
  }

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <main className="flex-1 overflow-y-auto pl-60">
        <div className="w-full px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight">Customers</h1>
            <p className="text-[14px] text-slate-500 mt-1">
              Manage customer relationships and view order history
            </p>
          </div>

          {/* Customers List */}
          <CustomersList initialCustomers={customers} />
        </div>
      </main>
    </div>
  )
}
