import { getUpcomingVisits, getPastVisits } from '@/lib/visits/queries'
import { getAccounts } from '@/lib/accounts/queries'
import { VisitsList } from '@/components/visits-list'

export default async function VisitsPage() {
  const [upcomingResult, pastResult, accountsResult] = await Promise.all([
    getUpcomingVisits(),
    getPastVisits(),
    getAccounts(),
  ])

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <VisitsList
        upcomingVisits={upcomingResult.visits}
        pastVisits={pastResult.visits}
        accounts={accountsResult.accounts}
      />
    </div>
  )
}
