import { getOrganizationId } from '@/lib/organizations/queries'
import { Card, CardContent } from '@kosha/ui'
import { AlertCircle } from 'lucide-react'
import { Insights } from './Insights'

export default async function InsightsPage() {
  const orgId = await getOrganizationId()

  if (!orgId) {
    return (
      <div className="flex min-h-screen bg-[#F7F8FA]">
        <main className="flex-1 overflow-y-auto md:pl-60">
          <div className="w-full px-6 lg:px-8 py-8 flex items-center justify-center min-h-[calc(100vh-4rem)]">
            <Card className="max-w-md">
              <CardContent className="pt-6 pb-6 text-center">
                <div className="flex justify-center mb-4">
                  <AlertCircle className="h-12 w-12 text-orange-500" />
                </div>
                <h2 className="text-xl font-semibold mb-2">No Organization Found</h2>
                <p className="text-slate-500">
                  You need to be part of an organization to use Insights.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <main className="flex-1 overflow-y-auto md:pl-60">
        <div className="w-full h-[calc(100vh)] flex flex-col">
          <Insights />
        </div>
      </main>
    </div>
  )
}
