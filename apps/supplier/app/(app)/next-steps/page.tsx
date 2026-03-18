import { getAllTasks } from '@/lib/tasks/queries'
import { getAccounts } from '@/lib/accounts/queries'
import { getTopPriorityAccounts } from '@/lib/scoring/queries'
import { NextStepsList } from '@/components/next-steps-list'

export default async function NextStepsPage() {
  const [{ tasks }, { accounts }, { accounts: priorityAccounts }] = await Promise.all([
    getAllTasks(),
    getAccounts(),
    getTopPriorityAccounts(10),
  ])

  return (
    <div className="min-h-screen bg-stone-50/50">
      <NextStepsList tasks={tasks} accounts={accounts} priorityAccounts={priorityAccounts} />
    </div>
  )
}
