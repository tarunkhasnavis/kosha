import { getAccounts } from '@/lib/accounts/queries'
import { getVisitsForDate } from '@/lib/visits/queries'
import { TerritoryMap } from '@/components/territory-map'

function getDateString(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().split('T')[0]
}

export default async function TerritoryPage() {
  const [
    { accounts },
    { visits: todayVisits },
    { visits: tomorrowVisits },
  ] = await Promise.all([
    getAccounts(),
    getVisitsForDate(getDateString(0)),
    getVisitsForDate(getDateString(1)),
  ])

  return (
    <TerritoryMap
      accounts={accounts}
      todayVisits={todayVisits}
      tomorrowVisits={tomorrowVisits}
    />
  )
}
