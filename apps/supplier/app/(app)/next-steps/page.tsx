import { getAllTasks } from '@/lib/tasks/queries'
import { getAccounts } from '@/lib/accounts/queries'
import { getTopPriorityAccounts } from '@/lib/scoring/queries'
import { NextStepsList } from '@/components/next-steps-list'
import { PriorityAccounts } from '@/components/priority-accounts'

export default async function NextStepsPage() {
  const [{ tasks }, { accounts }, { accounts: priorityAccounts }] = await Promise.all([
    getAllTasks(),
    getAccounts(),
    getTopPriorityAccounts(5),
  ])

  return (
    <div className="min-h-screen bg-stone-50/50">
      <PriorityAccounts accounts={priorityAccounts} />
      <NextStepsList tasks={tasks} accounts={accounts} />
    </div>
  )
}
