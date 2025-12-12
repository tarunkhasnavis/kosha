import { createClient } from '@/utils/supabase/server'
import { getOrganizationId } from '@/lib/db/organizations'
import { OrdersList } from './OrdersList'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export default async function OrdersPage() {
  // Auth handled by (app)/layout.tsx
  const supabase = await createClient()

  // Get user's organization ID
  const orgId = await getOrganizationId()

  if (!orgId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 pb-6 text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-orange-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No Organization Found</h2>
            <p className="text-muted-foreground">
              You need to be part of an organization to view orders. Please create or join an organization first.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fetch orders filtered by organization
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .eq('organization_id', orgId)
    .order('received_date', { ascending: false })

  if (ordersError) {
    console.error('Failed to fetch orders:', ordersError)
    return <div>Error loading orders</div>
  }

  // Fetch order_items for all orders using the foreign key relationship
  const orderIds = orders?.map(o => o.id) || []

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', orderIds)

  if (itemsError) {
    console.error('Failed to fetch order items:', itemsError)
  }

  // Fetch latest clarification_message for each order from order_emails
  // We need to get the most recent email's clarification_message for orders awaiting clarification
  const { data: orderEmails, error: emailsError } = await supabase
    .from('order_emails')
    .select('order_id, changes_made')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false })

  if (emailsError) {
    console.error('Failed to fetch order emails:', emailsError)
  }

  // Build a map of order_id -> latest clarification_message
  const clarificationMap = new Map<string, string | null>()
  orderEmails?.forEach(email => {
    // Only set if we haven't seen this order yet (first = most recent due to ordering)
    if (!clarificationMap.has(email.order_id)) {
      const changesMade = email.changes_made as { clarification_message?: string } | null
      clarificationMap.set(email.order_id, changesMade?.clarification_message || null)
    }
  })

  // Join order_items and clarification_message to their respective orders
  const ordersWithItems = orders?.map(order => ({
    ...order,
    items: orderItems?.filter(item => item.order_id === order.id) || [],
    clarification_message: clarificationMap.get(order.id) || null,
  })) || []

  const stats = {
    waitingReview: ordersWithItems?.filter(o => o.status === 'waiting_review').length || 0,
    uploadSuccessful: ordersWithItems?.filter(o => o.status === 'approved').length || 0,
    awaitingClarification: ordersWithItems?.filter(o => o.status === 'awaiting_clarification').length || 0,
    totalToday: ordersWithItems?.length || 0,
    processingTime: '2 min'
  }

  return <OrdersList initialOrders={ordersWithItems} initialStats={stats} />
}
