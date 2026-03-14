import { getAccounts } from '@/lib/accounts/queries'
import { AccountsList } from '@/components/accounts-list'

export default async function AccountsPage() {
  const { accounts } = await getAccounts()

  return (
    <div className="flex flex-col min-h-screen">
      <AccountsList initialAccounts={accounts} />
    </div>
  )
}
