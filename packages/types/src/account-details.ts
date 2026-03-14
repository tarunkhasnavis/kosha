export interface AccountContact {
  id: string
  organization_id: string
  account_id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  created_at: string
}

export interface AccountNote {
  id: string
  organization_id: string
  account_id: string
  user_id: string
  content: string
  created_at: string
}

export interface AccountPhoto {
  id: string
  organization_id: string
  account_id: string
  user_id: string
  url: string
  caption: string | null
  created_at: string
}
