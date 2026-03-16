import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@kosha/supabase/service'
import { createClient } from '@kosha/supabase/server'

export async function GET(request: NextRequest) {
  const accountName = request.nextUrl.searchParams.get('name') || 'Circles'

  // Check with service client (bypasses RLS)
  const service = createServiceClient()
  const { data: serviceData, error: serviceError } = await service
    .from('account_contacts')
    .select('*, accounts!inner(name)')
    .ilike('accounts.name', `%${accountName}%`)
    .limit(10)

  // Check with regular client (uses RLS)
  const regular = await createClient()
  const { data: regularData, error: regularError } = await regular
    .from('account_contacts')
    .select('*')
    .limit(10)

  // Also check total count
  const { count } = await service
    .from('account_contacts')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({
    totalContactsInDb: count,
    serviceClient: { data: serviceData, error: serviceError?.message },
    regularClient: { count: regularData?.length, error: regularError?.message, sample: regularData?.slice(0, 2) },
  })
}
