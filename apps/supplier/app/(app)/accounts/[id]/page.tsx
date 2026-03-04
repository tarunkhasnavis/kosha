import { notFound } from 'next/navigation'
import { getAccount } from '@/lib/accounts/queries'
import { getVisitsForAccount } from '@/lib/visits/queries'
import { getSignalsForAccount } from '@/lib/signals/queries'
import { getTasksForAccount } from '@/lib/tasks/queries'
import { AccountDetail } from '@/components/account-detail'
import { Button } from '@kosha/ui'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [{ account, error }, { visits }, { signals }, { tasks }] = await Promise.all([
    getAccount(id),
    getVisitsForAccount(id),
    getSignalsForAccount(id),
    getTasksForAccount(id),
  ])

  if (!account || error) {
    notFound()
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl">
      <Link href="/accounts">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Accounts
        </Button>
      </Link>
      <AccountDetail account={account} visits={visits} signals={signals} tasks={tasks} />
    </div>
  )
}
