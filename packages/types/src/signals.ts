export type SignalType = 'demand' | 'competitive' | 'friction' | 'expansion' | 'relationship'

export interface Signal {
  id: string
  user_id: string
  organization_id: string
  account_id: string
  account_name: string
  signal_type: SignalType
  description: string
  confidence: number
  sub_category: string
  suggested_action: string
  transcript: string | null
  capture_id: string | null
  created_at: string
}
