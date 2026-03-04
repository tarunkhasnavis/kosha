/**
 * Analytics Chat Tools
 *
 * Maps tool names to their implementations.
 * All tools are scoped to an organization for multi-tenant isolation.
 */

import {
  getOrderStats,
  getTopCustomers,
  getTopProducts,
  comparePeriods,
  getCustomerDetails,
  getOrderTrends,
} from './queries'
import {
  OrderStatsParamsSchema,
  TopCustomersParamsSchema,
  TopProductsParamsSchema,
  ComparePeriodParamsSchema,
  CustomerDetailsParamsSchema,
  OrderTrendsParamsSchema,
} from './types'

export type ToolName =
  | 'get_order_stats'
  | 'get_top_customers'
  | 'get_top_products'
  | 'compare_periods'
  | 'get_customer_details'
  | 'get_order_trends'

export interface ToolCallResult {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Execute a tool by name with the given arguments
 */
export async function executeTool(
  toolName: string,
  args: unknown,
  organizationId: string
): Promise<ToolCallResult> {
  try {
    switch (toolName) {
      case 'get_order_stats': {
        const parsed = OrderStatsParamsSchema.safeParse(args)
        if (!parsed.success) {
          return { success: false, error: `Invalid parameters: ${parsed.error.message}` }
        }
        const data = await getOrderStats(organizationId, parsed.data)
        return { success: true, data }
      }

      case 'get_top_customers': {
        const parsed = TopCustomersParamsSchema.safeParse(args)
        if (!parsed.success) {
          return { success: false, error: `Invalid parameters: ${parsed.error.message}` }
        }
        const data = await getTopCustomers(organizationId, parsed.data)
        return { success: true, data }
      }

      case 'get_top_products': {
        const parsed = TopProductsParamsSchema.safeParse(args)
        if (!parsed.success) {
          return { success: false, error: `Invalid parameters: ${parsed.error.message}` }
        }
        const data = await getTopProducts(organizationId, parsed.data)
        return { success: true, data }
      }

      case 'compare_periods': {
        const parsed = ComparePeriodParamsSchema.safeParse(args)
        if (!parsed.success) {
          return { success: false, error: `Invalid parameters: ${parsed.error.message}` }
        }
        const data = await comparePeriods(organizationId, parsed.data)
        return { success: true, data }
      }

      case 'get_customer_details': {
        const parsed = CustomerDetailsParamsSchema.safeParse(args)
        if (!parsed.success) {
          return { success: false, error: `Invalid parameters: ${parsed.error.message}` }
        }
        const data = await getCustomerDetails(organizationId, parsed.data)
        return { success: true, data }
      }

      case 'get_order_trends': {
        const parsed = OrderTrendsParamsSchema.safeParse(args)
        if (!parsed.success) {
          return { success: false, error: `Invalid parameters: ${parsed.error.message}` }
        }
        const data = await getOrderTrends(organizationId, parsed.data)
        return { success: true, data }
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` }
    }
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
