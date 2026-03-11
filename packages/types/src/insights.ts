export type InsightType = 'demand' | 'competitive' | 'friction' | 'expansion' | 'relationship' | 'promotion'

export interface Insight {
  id: string
  user_id: string
  organization_id: string
  account_id: string
  account_name: string
  insight_type: InsightType
  description: string
  sub_category: string
  suggested_action: string
  transcript: string | null
  capture_id: string | null
  created_at: string
}
