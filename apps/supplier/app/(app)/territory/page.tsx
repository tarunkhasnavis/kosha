import { getAccounts } from '@/lib/accounts/queries'
import { TerritoryMap } from '@/components/territory-map'

export default async function TerritoryPage() {
  const { accounts } = await getAccounts()

  return <TerritoryMap accounts={accounts} />
}
