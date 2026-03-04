import { getAccounts } from '@/lib/accounts/queries'
import { getRecentSignals } from '@/lib/signals/queries'
import { VoiceAgent } from '@/components/voice-agent'
import { SignalsList } from '@/components/signals-list'

export default async function CapturePage() {
  const [{ accounts }, { signals }] = await Promise.all([
    getAccounts(),
    getRecentSignals(),
  ])

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="space-y-8">
        <VoiceAgent accounts={accounts} />
        <SignalsList signals={signals} />
      </div>
    </div>
  )
}
