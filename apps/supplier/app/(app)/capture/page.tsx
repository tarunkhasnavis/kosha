import { getAccounts } from '@/lib/accounts/queries'
import { getRecentCaptures } from '@/lib/captures/queries'
import { VoiceAgent } from '@/components/voice-agent'

export default async function CapturePage() {
  const [{ accounts }, { captures }] = await Promise.all([
    getAccounts(),
    getRecentCaptures(10),
  ])

  return (
    <div className="bg-stone-50/50 min-h-screen">
      <VoiceAgent accounts={accounts} captures={captures} />
    </div>
  )
}
