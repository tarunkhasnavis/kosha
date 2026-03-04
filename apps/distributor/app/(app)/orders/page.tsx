import { createClient } from '@kosha/supabase/server'
import { getUserOrganization } from '@/lib/organizations/queries'
import { OrdersList } from './OrdersList'
import { Card, CardContent } from '@kosha/ui'
import { AlertCircle } from 'lucide-react'
import { getOrgRequiredFields } from '@/lib/orders/field-config'

export default async function OrdersPage() {
  // Auth handled by (app)/layout.tsx
  const supabase = await createClient()

  // Get user's organization info
  const org = await getUserOrganization()
  const orgId = org?.id

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

  // Fetch organization's required fields config
  const { data: orgData } = await supabase
    .from('organizations')
    .select('required_order_fields')
    .eq('id', orgId)
    .single()

  const orgRequiredFields = getOrgRequiredFields(orgData?.required_order_fields)

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

  // Fetch active (non-deleted) items
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', orderIds)
    .or('deleted.is.null,deleted.eq.false')

  if (itemsError) {
    console.error('Failed to fetch order items:', itemsError)
  }

  // Fetch deleted items separately
  const { data: deletedOrderItems, error: deletedItemsError } = await supabase
    .from('order_items')
    .select('*')
    .in('order_id', orderIds)
    .eq('deleted', true)

  if (deletedItemsError) {
    console.error('Failed to fetch deleted order items:', deletedItemsError)
  }

  // Fetch email data for each order from order_emails (for original email display only)
  // NOTE: clarification_message is now on the orders table directly, not in order_emails
  const { data: orderEmails, error: emailsError } = await supabase
    .from('order_emails')
    .select('order_id, email_body, email_body_html, email_from, email_date, created_at')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false })

  if (emailsError) {
    console.error('Failed to fetch order emails:', emailsError)
  }

  // Build map for order_id -> original email data (for displaying original email in UI)
  const originalEmailMap = new Map<string, { body: string | null, bodyHtml: string | null, from: string | null, date: string | null }>()

  orderEmails?.forEach(email => {
    // Always update original email - last one processed will be the oldest (due to desc order)
    originalEmailMap.set(email.order_id, {
      body: email.email_body || null,
      bodyHtml: email.email_body_html || null,
      from: email.email_from || null,
      date: email.email_date || null,
    })
  })

  // Join order_items and original email data to their respective orders
  // NOTE: clarification_message comes directly from the order (source of truth)
  const ordersWithItems = orders?.map(order => {
    const originalEmail = originalEmailMap.get(order.id)
    return {
      ...order,
      items: orderItems?.filter(item => item.order_id === order.id) || [],
      deletedItems: deletedOrderItems?.filter(item => item.order_id === order.id) || [],
      // clarification_message is already on order from select('*')
      original_email_body: originalEmail?.body || null,
      original_email_body_html: originalEmail?.bodyHtml || null,
      original_email_from: originalEmail?.from || null,
      original_email_date: originalEmail?.date || null,
    }
  }) || []

  const stats = {
    waitingReview: ordersWithItems?.filter(o => o.status === 'waiting_review').length || 0,
    uploadSuccessful: ordersWithItems?.filter(o => o.status === 'approved').length || 0,
    awaitingClarification: ordersWithItems?.filter(o => o.status === 'awaiting_clarification').length || 0,
    totalToday: ordersWithItems?.length || 0,
    processingTime: '2 min'
  }

  return (
    <OrdersList
      initialOrders={ordersWithItems}
      initialStats={stats}
      orgRequiredFields={orgRequiredFields}
    />
  )
}
