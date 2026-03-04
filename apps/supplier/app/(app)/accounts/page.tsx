import { getAccounts } from '@/lib/accounts/queries'
import { AccountsList } from '@/components/accounts-list'

export default async function AccountsPage() {
  const { accounts } = await getAccounts()

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <AccountsList initialAccounts={accounts} />
    </div>
  )
}
