import { getAccounts } from '@/lib/accounts/queries'
import { getRecentCaptures } from '@/lib/captures/queries'
import { VoiceAgent } from '@/components/voice-agent'
import { ConversationList } from '@/components/conversation-list'

export default async function CapturePage() {
  const [{ accounts }, { captures }] = await Promise.all([
    getAccounts(),
    getRecentCaptures(5),
  ])

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="space-y-8">
        <VoiceAgent accounts={accounts} />
        {captures.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Recent Conversations
            </h3>
            <ConversationList captures={captures} />
          </div>
        )}
      </div>
    </div>
  )
}
