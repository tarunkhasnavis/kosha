import { createClient } from '@/utils/supabase/server'
import { getOrganizationId } from '@/lib/db/organizations'
import { OrdersList } from './OrdersList'

export default async function OrdersPage() {
  // Auth handled by (app)/layout.tsx
  const supabase = await createClient()

  // Get user's organization ID
  const orgId = await getOrganizationId()

  if (!orgId) {
    return <div>No organization found. Please create an organization first.</div>
  }

  // Fetch orders filtered by organization (manual filtering since no RLS)
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('organization_id', orgId)  // ← Manual filter by org
    // TODO: Uncomment when order_items table is ready
    // .select(`
    //   *,
    //   items:order_items(*)
    // `)
    .order('received_date', { ascending: false })

  if (error) {
    console.error('Failed to fetch orders:', error)
    return <div>Error loading orders</div>
  }

  const stats = {
    waitingReview: orders?.filter(o => o.status === 'waiting_review').length || 0,
    uploadSuccessful: orders?.filter(o => o.status === 'approved').length || 0,
    totalToday: orders?.length || 0,
    processingTime: '2 min'
  }

  return <OrdersList initialOrders={orders || []} initialStats={stats} />
}
