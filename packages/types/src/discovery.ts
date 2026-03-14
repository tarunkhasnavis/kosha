export type DiscoveryCategory =
  | 'bar'
  | 'restaurant'
  | 'liquor_store'
  | 'brewery'
  | 'hotel'
  | 'convenience_store'

export interface DiscoveredAccount {
  id: string
  organization_id: string
  name: string
  address: string
  phone: string | null
  google_place_id: string | null
  category: DiscoveryCategory
  latitude: number
  longitude: number
  google_rating: number | null
  google_review_count: number | null
  ai_score: number
  ai_reasons: string[]
  hours: string | null
  website: string | null
  is_claimed: boolean
  created_at: string
}
