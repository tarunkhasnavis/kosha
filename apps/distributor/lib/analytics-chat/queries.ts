/**
 * Analytics Chat Queries
 *
 * Read-only database operations for analytics.
 * All queries are scoped to the current organization.
 */

import { createClient } from '@kosha/supabase/server'
import type {
  OrderStatsParams,
  OrderStatsResult,
  TopCustomersParams,
  TopCustomerResult,
  TopProductsParams,
  TopProductResult,
  ComparePeriodParams,
  PeriodComparisonResult,
  CustomerDetailsParams,
  CustomerDetailsResult,
  OrderTrendsParams,
  OrderTrendsResult,
  TrendDataPoint,
} from './types'

// =============================================================================
// Order Statistics
// =============================================================================

/**
 * Get order statistics for a date range
 */
export async function getOrderStats(
  organizationId: string,
  params: OrderStatsParams
): Promise<OrderStatsResult> {
  const supabase = await createClient()

  let query = supabase
    .from('orders')
    .select('order_value')
    .eq('organization_id', organizationId)
    .gte('received_date', params.start_date)
    .lte('received_date', params.end_date)

  // Apply status filter if not 'all'
  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to get order stats:', error)
    return {
      order_count: 0,
      total_value: 0,
      average_value: 0,
      date_range: { start: params.start_date, end: params.end_date },
      status_filter: params.status || 'all',
    }
  }

  const orders = data || []
  const orderCount = orders.length
  const totalValue = orders.reduce((sum, o) => sum + (o.order_value || 0), 0)
  const averageValue = orderCount > 0 ? totalValue / orderCount : 0

  return {
    order_count: orderCount,
    total_value: Math.round(totalValue * 100) / 100,
    average_value: Math.round(averageValue * 100) / 100,
    date_range: { start: params.start_date, end: params.end_date },
    status_filter: params.status || 'all',
  }
}

// =============================================================================
// Top Customers
// =============================================================================

/**
 * Get top customers by spend or order count
 */
export async function getTopCustomers(
  organizationId: string,
  params: TopCustomersParams
): Promise<TopCustomerResult[]> {
  const supabase = await createClient()
  const limit = Math.min(params.limit || 10, 50)

  // If we have date filters, we need to aggregate from orders
  if (params.start_date || params.end_date) {
    let query = supabase
      .from('orders')
      .select('customer_id, order_value, customers!inner(id, name, customer_number)')
      .eq('organization_id', organizationId)
      .not('customer_id', 'is', null)

    if (params.start_date) {
      query = query.gte('received_date', params.start_date)
    }
    if (params.end_date) {
      query = query.lte('received_date', params.end_date)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to get top customers:', error)
      return []
    }

    // Aggregate by customer
    const customerMap = new Map<string, {
      name: string
      customer_number: string | null
      total_spend: number
      order_count: number
    }>()

    for (const order of data || []) {
      const customerId = order.customer_id
      const customer = order.customers as { id: string; name: string; customer_number: string | null }

      if (!customerId || !customer) continue

      const existing = customerMap.get(customerId)
      if (existing) {
        existing.total_spend += order.order_value || 0
        existing.order_count += 1
      } else {
        customerMap.set(customerId, {
          name: customer.name,
          customer_number: customer.customer_number,
          total_spend: order.order_value || 0,
          order_count: 1,
        })
      }
    }

    // Sort and limit
    const results = Array.from(customerMap.values())
    if (params.metric === 'total_spend') {
      results.sort((a, b) => b.total_spend - a.total_spend)
    } else {
      results.sort((a, b) => b.order_count - a.order_count)
    }

    return results.slice(0, limit).map(c => ({
      name: c.name,
      customer_number: c.customer_number,
      total_spend: Math.round(c.total_spend * 100) / 100,
      order_count: c.order_count,
    }))
  }

  // No date filter - use pre-aggregated customer data
  const sortColumn = params.metric === 'total_spend' ? 'total_spend' : 'total_orders'

  const { data, error } = await supabase
    .from('customers')
    .select('name, customer_number, total_spend, total_orders')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .gt(sortColumn, 0)
    .order(sortColumn, { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to get top customers:', error)
    return []
  }

  return (data || []).map(c => ({
    name: c.name,
    customer_number: c.customer_number,
    total_spend: c.total_spend || 0,
    order_count: c.total_orders || 0,
  }))
}

// =============================================================================
// Top Products
// =============================================================================

/**
 * Get top products by revenue or quantity
 */
export async function getTopProducts(
  organizationId: string,
  params: TopProductsParams
): Promise<TopProductResult[]> {
  const supabase = await createClient()
  const limit = Math.min(params.limit || 10, 50)

  // Query order items joined with orders for date filtering
  let query = supabase
    .from('order_items')
    .select(`
      sku,
      name,
      quantity,
      total,
      orders!inner(organization_id, received_date)
    `)
    .eq('orders.organization_id', organizationId)
    .eq('deleted', false)

  if (params.start_date) {
    query = query.gte('orders.received_date', params.start_date)
  }
  if (params.end_date) {
    query = query.lte('orders.received_date', params.end_date)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to get top products:', error)
    return []
  }

  // Aggregate by product (SKU or name)
  const productMap = new Map<string, {
    sku: string
    name: string
    total_revenue: number
    total_quantity: number
  }>()

  for (const item of data || []) {
    const key = item.sku || item.name
    const existing = productMap.get(key)

    if (existing) {
      existing.total_revenue += item.total || 0
      existing.total_quantity += item.quantity || 0
    } else {
      productMap.set(key, {
        sku: item.sku || '',
        name: item.name,
        total_revenue: item.total || 0,
        total_quantity: item.quantity || 0,
      })
    }
  }

  // Sort and limit
  const results = Array.from(productMap.values())
  if (params.metric === 'revenue') {
    results.sort((a, b) => b.total_revenue - a.total_revenue)
  } else {
    results.sort((a, b) => b.total_quantity - a.total_quantity)
  }

  return results.slice(0, limit).map(p => ({
    sku: p.sku,
    name: p.name,
    total_revenue: Math.round(p.total_revenue * 100) / 100,
    total_quantity: p.total_quantity,
  }))
}

// =============================================================================
// Period Comparison
// =============================================================================

/**
 * Compare metrics between two time periods
 */
export async function comparePeriods(
  organizationId: string,
  params: ComparePeriodParams
): Promise<PeriodComparisonResult> {
  // Get stats for both periods
  const [period1Stats, period2Stats] = await Promise.all([
    getOrderStats(organizationId, {
      start_date: params.period1_start,
      end_date: params.period1_end,
    }),
    getOrderStats(organizationId, {
      start_date: params.period2_start,
      end_date: params.period2_end,
    }),
  ])

  // Extract the relevant metric
  let value1: number
  let value2: number

  switch (params.metric) {
    case 'order_count':
      value1 = period1Stats.order_count
      value2 = period2Stats.order_count
      break
    case 'order_value':
      value1 = period1Stats.total_value
      value2 = period2Stats.total_value
      break
    case 'avg_order_value':
      value1 = period1Stats.average_value
      value2 = period2Stats.average_value
      break
  }

  const change = value2 - value1
  const changePercent = value1 > 0 ? ((value2 - value1) / value1) * 100 : 0

  return {
    metric: params.metric,
    period1: {
      start: params.period1_start,
      end: params.period1_end,
      value: value1,
    },
    period2: {
      start: params.period2_start,
      end: params.period2_end,
      value: value2,
    },
    change: Math.round(change * 100) / 100,
    change_percent: Math.round(changePercent * 10) / 10,
  }
}

// =============================================================================
// Customer Details
// =============================================================================

/**
 * Get detailed information about a specific customer
 */
export async function getCustomerDetails(
  organizationId: string,
  params: CustomerDetailsParams
): Promise<CustomerDetailsResult> {
  const supabase = await createClient()
  const includeOrders = params.include_orders !== false

  // Search for customer by name (partial match)
  const { data: customers, error: searchError } = await supabase
    .from('customers')
    .select('*')
    .eq('organization_id', organizationId)
    .ilike('name', `%${params.customer_name}%`)
    .eq('is_active', true)
    .limit(1)

  if (searchError || !customers || customers.length === 0) {
    return { found: false }
  }

  const customer = customers[0]

  const result: CustomerDetailsResult = {
    found: true,
    customer: {
      id: customer.id,
      name: customer.name,
      customer_number: customer.customer_number,
      primary_contact_email: customer.primary_contact_email,
      primary_contact_phone: customer.primary_contact_phone,
      total_orders: customer.total_orders || 0,
      total_spend: customer.total_spend || 0,
      average_order_value: customer.average_order_value,
      first_order_date: customer.first_order_date,
      last_order_date: customer.last_order_date,
    },
  }

  // Optionally include recent orders
  if (includeOrders) {
    const { data: orders } = await supabase
      .from('orders')
      .select('order_number, received_date, status, order_value')
      .eq('customer_id', customer.id)
      .eq('organization_id', organizationId)
      .order('received_date', { ascending: false })
      .limit(5)

    result.recent_orders = (orders || []).map(o => ({
      order_number: o.order_number,
      received_date: o.received_date,
      status: o.status,
      order_value: o.order_value || 0,
    }))
  }

  return result
}

// =============================================================================
// Order Trends
// =============================================================================

/**
 * Get order trends over time
 */
export async function getOrderTrends(
  organizationId: string,
  params: OrderTrendsParams
): Promise<OrderTrendsResult> {
  const supabase = await createClient()
  const metric = params.metric || 'count'

  const { data, error } = await supabase
    .from('orders')
    .select('received_date, order_value')
    .eq('organization_id', organizationId)
    .gte('received_date', params.start_date)
    .lte('received_date', params.end_date)
    .order('received_date', { ascending: true })

  if (error) {
    console.error('Failed to get order trends:', error)
    return {
      granularity: params.granularity,
      metric,
      data_points: [],
    }
  }

  // Group by period
  const periodMap = new Map<string, { count: number; value: number }>()

  for (const order of data || []) {
    const period = getPeriodKey(order.received_date, params.granularity)
    const existing = periodMap.get(period)

    if (existing) {
      existing.count += 1
      existing.value += order.order_value || 0
    } else {
      periodMap.set(period, {
        count: 1,
        value: order.order_value || 0,
      })
    }
  }

  // Convert to array of data points
  const dataPoints: TrendDataPoint[] = Array.from(periodMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, stats]) => ({
      period,
      value: metric === 'count' ? stats.count : Math.round(stats.value * 100) / 100,
    }))

  return {
    granularity: params.granularity,
    metric,
    data_points: dataPoints,
  }
}

/**
 * Get the period key for a date based on granularity
 */
function getPeriodKey(dateStr: string, granularity: 'daily' | 'weekly' | 'monthly'): string {
  const date = new Date(dateStr)

  switch (granularity) {
    case 'daily':
      return dateStr.slice(0, 10) // YYYY-MM-DD

    case 'weekly': {
      // Get the Monday of the week
      const day = date.getDay()
      const diff = date.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(date)
      monday.setDate(diff)
      return `Week of ${monday.toISOString().slice(0, 10)}`
    }

    case 'monthly':
      return date.toISOString().slice(0, 7) // YYYY-MM
  }
}
