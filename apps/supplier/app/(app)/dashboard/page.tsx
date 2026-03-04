import { Card, CardContent, CardHeader, CardTitle } from '@kosha/ui'
import { Building2, CalendarCheck, Radio, DollarSign, CheckSquare } from 'lucide-react'
import { getAccountStats } from '@/lib/accounts/queries'
import { getVisitsThisWeek } from '@/lib/visits/queries'
import { getSignalCount } from '@/lib/signals/queries'
import { getPendingTaskCount } from '@/lib/tasks/queries'

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
  if (value > 0) return `$${value.toFixed(0)}`
  return '—'
}

export default async function DashboardPage() {
  const [{ totalAccounts, totalArr }, visitsThisWeek, signalCount, pendingTaskCount] = await Promise.all([
    getAccountStats(),
    getVisitsThisWeek(),
    getSignalCount(),
    getPendingTaskCount(),
  ])

  const stats = [
    { title: 'Total Accounts', value: totalAccounts.toString(), icon: Building2 },
    { title: 'Visits This Week', value: visitsThisWeek.toString(), icon: CalendarCheck },
    { title: 'Signals Captured', value: signalCount.toString(), icon: Radio },
    { title: 'Pending Tasks', value: pendingTaskCount.toString(), icon: CheckSquare },
    { title: 'Revenue Pipeline', value: formatCurrency(totalArr), icon: DollarSign },
  ]

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
