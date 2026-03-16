import { notFound } from 'next/navigation'
import { getAccount, getAccountContacts, getAccountNotes, getAccountPhotos } from '@/lib/accounts/queries'
import { getVisitsForAccount } from '@/lib/visits/queries'
import { getInsightsForAccount } from '@/lib/insights/queries'
import { getTasksForAccount } from '@/lib/tasks/queries'
import { getCapturesForAccount } from '@/lib/captures/queries'
import { AccountDetail } from '@/components/account-detail'
import { BackButton } from './back-button'

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [
    { account, error },
    { visits },
    { insights },
    { tasks },
    { captures },
    { contacts },
    { notes },
    { photos },
  ] = await Promise.all([
    getAccount(id),
    getVisitsForAccount(id),
    getInsightsForAccount(id),
    getTasksForAccount(id),
    getCapturesForAccount(id),
    getAccountContacts(id),
    getAccountNotes(id),
    getAccountPhotos(id),
  ])

  if (!account || error) {
    notFound()
  }

  return (
    <div className="p-4 max-w-3xl">
      <BackButton />
      <AccountDetail
        account={account}
        visits={visits}
        insights={insights}
        tasks={tasks}
        captures={captures}
        contacts={contacts}
        notes={notes}
        photos={photos}
      />
    </div>
  )
}
