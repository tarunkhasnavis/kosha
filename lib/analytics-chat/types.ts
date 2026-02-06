/**
 * Analytics Chat Types & Tool Definitions
 *
 * Defines the types for the analytics chat feature, including:
 * - Chat message types
 * - OpenAI function calling tool definitions
 * - Zod schemas for validation
 */

import { z } from 'zod'

// =============================================================================
// Chat Message Types
// =============================================================================

export interface AnalyticsChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  analyticsData?: AnalyticsData
}

export interface AnalyticsData {
  type: 'stats' | 'table' | 'comparison' | 'trend' | 'customer_details'
  title?: string
  data: unknown
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface AnalyticsChatRequest {
  message: string
  conversation_history: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

export interface AnalyticsChatResponse {
  message: string
  data?: AnalyticsData
  latency_ms: number
  error?: string
}

// =============================================================================
// Tool Parameter Types
// =============================================================================

export interface OrderStatsParams {
  start_date: string
  end_date: string
  status?: 'all' | 'waiting_review' | 'approved' | 'rejected' | 'archived' | 'processing'
}

export interface TopCustomersParams {
  metric: 'total_spend' | 'order_count'
  limit?: number
  start_date?: string
  end_date?: string
}

export interface TopProductsParams {
  metric: 'revenue' | 'quantity'
  limit?: number
  start_date?: string
  end_date?: string
}

export interface ComparePeriodParams {
  metric: 'order_count' | 'order_value' | 'avg_order_value'
  period1_start: string
  period1_end: string
  period2_start: string
  period2_end: string
}

export interface CustomerDetailsParams {
  customer_name: string
  include_orders?: boolean
}

export interface OrderTrendsParams {
  granularity: 'daily' | 'weekly' | 'monthly'
  start_date: string
  end_date: string
  metric: 'count' | 'value'
}

// =============================================================================
// Tool Result Types
// =============================================================================

export interface OrderStatsResult {
  order_count: number
  total_value: number
  average_value: number
  date_range: { start: string; end: string }
  status_filter: string
}

export interface TopCustomerResult {
  name: string
  customer_number: string | null
  total_spend: number
  order_count: number
}

export interface TopProductResult {
  sku: string
  name: string
  total_revenue: number
  total_quantity: number
}

export interface PeriodComparisonResult {
  metric: string
  period1: { start: string; end: string; value: number }
  period2: { start: string; end: string; value: number }
  change: number
  change_percent: number
}

export interface CustomerDetailsResult {
  found: boolean
  customer?: {
    id: string
    name: string
    customer_number: string | null
    primary_contact_email: string | null
    primary_contact_phone: string | null
    total_orders: number
    total_spend: number
    average_order_value: number | null
    first_order_date: string | null
    last_order_date: string | null
  }
  recent_orders?: Array<{
    order_number: string
    received_date: string
    status: string
    order_value: number
  }>
}

export interface TrendDataPoint {
  period: string
  value: number
}

export interface OrderTrendsResult {
  granularity: string
  metric: string
  data_points: TrendDataPoint[]
}

// =============================================================================
// OpenAI Function Calling Tool Definitions
// =============================================================================

export const ANALYTICS_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_order_stats',
      description: 'Get order statistics for a date range including count, total value, and average value. Use this for questions like "How many orders did we get this month?" or "What was our total revenue in January?"',
      parameters: {
        type: 'object',
        properties: {
          start_date: {
            type: 'string',
            description: 'Start date in ISO format (YYYY-MM-DD)',
          },
          end_date: {
            type: 'string',
            description: 'End date in ISO format (YYYY-MM-DD)',
          },
          status: {
            type: 'string',
            enum: ['all', 'waiting_review', 'approved', 'rejected', 'archived', 'processing'],
            description: 'Filter by order status. Default is "all"',
          },
        },
        required: ['start_date', 'end_date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_top_customers',
      description: 'Get top customers ranked by total spend or order count. Use this for questions like "Who are my best customers?" or "Which customers order the most?"',
      parameters: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            enum: ['total_spend', 'order_count'],
            description: 'Metric to rank by',
          },
          limit: {
            type: 'number',
            description: 'Number of customers to return (default: 10, max: 50)',
          },
          start_date: {
            type: 'string',
            description: 'Optional: Filter to orders after this date (YYYY-MM-DD)',
          },
          end_date: {
            type: 'string',
            description: 'Optional: Filter to orders before this date (YYYY-MM-DD)',
          },
        },
        required: ['metric'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_top_products',
      description: 'Get top products ranked by revenue or quantity sold. Use this for questions like "What are my best selling products?" or "Which products generate the most revenue?"',
      parameters: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            enum: ['revenue', 'quantity'],
            description: 'Metric to rank by',
          },
          limit: {
            type: 'number',
            description: 'Number of products to return (default: 10, max: 50)',
          },
          start_date: {
            type: 'string',
            description: 'Optional: Filter to orders after this date (YYYY-MM-DD)',
          },
          end_date: {
            type: 'string',
            description: 'Optional: Filter to orders before this date (YYYY-MM-DD)',
          },
        },
        required: ['metric'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_periods',
      description: 'Compare a metric between two time periods. Use this for questions like "How did this month compare to last month?" or "Are orders up or down this quarter?"',
      parameters: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            enum: ['order_count', 'order_value', 'avg_order_value'],
            description: 'Metric to compare',
          },
          period1_start: {
            type: 'string',
            description: 'First period start date (YYYY-MM-DD) - typically the earlier/baseline period',
          },
          period1_end: {
            type: 'string',
            description: 'First period end date (YYYY-MM-DD)',
          },
          period2_start: {
            type: 'string',
            description: 'Second period start date (YYYY-MM-DD) - typically the more recent period',
          },
          period2_end: {
            type: 'string',
            description: 'Second period end date (YYYY-MM-DD)',
          },
        },
        required: ['metric', 'period1_start', 'period1_end', 'period2_start', 'period2_end'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_customer_details',
      description: 'Look up details about a specific customer by name. Use this for questions like "Tell me about customer X" or "What is the order history for ABC Company?"',
      parameters: {
        type: 'object',
        properties: {
          customer_name: {
            type: 'string',
            description: 'Customer name to search for (partial match supported)',
          },
          include_orders: {
            type: 'boolean',
            description: 'Include recent orders in the response (default: true)',
          },
        },
        required: ['customer_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_order_trends',
      description: 'Get order trends over time with daily, weekly, or monthly aggregates. Use this for questions like "Show me order trends over the past quarter" or "What does our weekly order volume look like?"',
      parameters: {
        type: 'object',
        properties: {
          granularity: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly'],
            description: 'Time granularity for aggregation',
          },
          start_date: {
            type: 'string',
            description: 'Start date (YYYY-MM-DD)',
          },
          end_date: {
            type: 'string',
            description: 'End date (YYYY-MM-DD)',
          },
          metric: {
            type: 'string',
            enum: ['count', 'value'],
            description: 'Metric to aggregate: count = number of orders, value = order value',
          },
        },
        required: ['granularity', 'start_date', 'end_date'],
      },
    },
  },
]

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

export const OrderStatsParamsSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  status: z.enum(['all', 'waiting_review', 'approved', 'rejected', 'archived', 'processing']).optional(),
})

export const TopCustomersParamsSchema = z.object({
  metric: z.enum(['total_spend', 'order_count']),
  limit: z.number().min(1).max(50).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

export const TopProductsParamsSchema = z.object({
  metric: z.enum(['revenue', 'quantity']),
  limit: z.number().min(1).max(50).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

export const ComparePeriodParamsSchema = z.object({
  metric: z.enum(['order_count', 'order_value', 'avg_order_value']),
  period1_start: z.string(),
  period1_end: z.string(),
  period2_start: z.string(),
  period2_end: z.string(),
})

export const CustomerDetailsParamsSchema = z.object({
  customer_name: z.string().min(1),
  include_orders: z.boolean().optional(),
})

export const OrderTrendsParamsSchema = z.object({
  granularity: z.enum(['daily', 'weekly', 'monthly']),
  start_date: z.string(),
  end_date: z.string(),
  metric: z.enum(['count', 'value']).optional(),
})
