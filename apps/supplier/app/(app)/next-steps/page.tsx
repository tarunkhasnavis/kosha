import { getAllTasks } from '@/lib/tasks/queries'
import { getAccounts } from '@/lib/accounts/queries'
import { NextStepsList } from '@/components/next-steps-list'

export default async function NextStepsPage() {
  const [{ tasks }, { accounts }] = await Promise.all([
    getAllTasks(),
    getAccounts(),
  ])

  return (
    <div className="min-h-screen bg-stone-50/50">
      <NextStepsList tasks={tasks} accounts={accounts} />
    </div>
  )
}
