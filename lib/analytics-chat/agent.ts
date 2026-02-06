/**
 * Insights Chat Agent
 *
 * OpenAI-powered agent that uses function calling to answer
 * analytics questions about order data.
 */

import { getOpenAI } from '@/lib/openai'
import { buildSystemPrompt } from './system-prompt'
import { ANALYTICS_TOOLS, AnalyticsData } from './types'
import { executeTool } from './tools'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

// =============================================================================
// Types
// =============================================================================

export interface InsightsAgentParams {
  userMessage: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  organizationId: string
  organizationName: string
}

export interface InsightsAgentResult {
  success: boolean
  response: string
  analyticsData?: AnalyticsData
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  toolCalls?: Array<{ name: string; args: unknown; result: unknown }>
}

// =============================================================================
// Agent Implementation
// =============================================================================

const MODEL = 'gpt-4o-mini'
const MAX_TOOL_CALLS = 5 // Prevent infinite loops

/**
 * Call the insights agent with conversation context
 */
export async function callInsightsAgent(
  params: InsightsAgentParams
): Promise<InsightsAgentResult> {
  const startTime = Date.now()
  const openai = getOpenAI()

  // Build messages array
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildSystemPrompt(params.organizationName),
    },
  ]

  // Add conversation history (last 10 messages for context)
  const recentHistory = params.conversationHistory.slice(-10)
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    })
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: params.userMessage,
  })

  let totalInputTokens = 0
  let totalOutputTokens = 0
  const toolCallsLog: Array<{ name: string; args: unknown; result: unknown }> = []

  try {
    // Function calling loop
    let iterations = 0

    while (iterations < MAX_TOOL_CALLS) {
      iterations++

      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages,
        tools: ANALYTICS_TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 1000,
      })

      totalInputTokens += completion.usage?.prompt_tokens || 0
      totalOutputTokens += completion.usage?.completion_tokens || 0

      const choice = completion.choices[0]
      const message = choice.message

      // If no tool calls, we have the final response
      if (!message.tool_calls || message.tool_calls.length === 0) {
        const latencyMs = Date.now() - startTime

        // Determine if we should include analytics data
        let analyticsData: AnalyticsData | undefined
        if (toolCallsLog.length > 0) {
          // Use the last tool call result as the data
          const lastCall = toolCallsLog[toolCallsLog.length - 1]
          analyticsData = inferAnalyticsDataType(lastCall.name, lastCall.result)
        }

        return {
          success: true,
          response: message.content || "I couldn't generate a response. Please try again.",
          analyticsData,
          model: MODEL,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          latencyMs,
          toolCalls: toolCallsLog,
        }
      }

      // Add assistant message with tool calls to history
      messages.push({
        role: 'assistant',
        content: message.content,
        tool_calls: message.tool_calls,
      })

      // Execute each tool call
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name
        let args: unknown

        try {
          args = JSON.parse(toolCall.function.arguments)
        } catch {
          args = {}
        }

        // Execute the tool
        const result = await executeTool(toolName, args, params.organizationId)

        // Log the tool call
        toolCallsLog.push({
          name: toolName,
          args,
          result: result.data || result.error,
        })

        // Add tool result to messages
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result.success ? result.data : { error: result.error }),
        })
      }
    }

    // If we hit max iterations, return what we have
    const latencyMs = Date.now() - startTime
    return {
      success: false,
      response: "I had trouble processing your request. Please try rephrasing your question.",
      model: MODEL,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      latencyMs,
      toolCalls: toolCallsLog,
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime
    console.error('Insights agent error:', error)

    return {
      success: false,
      response: "I encountered an error while processing your request. Please try again.",
      model: MODEL,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      latencyMs,
    }
  }
}

/**
 * Infer the analytics data type from the tool name and result
 */
function inferAnalyticsDataType(toolName: string, result: unknown): AnalyticsData | undefined {
  if (!result) return undefined

  switch (toolName) {
    case 'get_order_stats':
      return {
        type: 'stats',
        title: 'Order Statistics',
        data: result,
      }

    case 'get_top_customers':
      return {
        type: 'table',
        title: 'Top Customers',
        data: result,
      }

    case 'get_top_products':
      return {
        type: 'table',
        title: 'Top Products',
        data: result,
      }

    case 'compare_periods':
      return {
        type: 'comparison',
        title: 'Period Comparison',
        data: result,
      }

    case 'get_customer_details':
      return {
        type: 'customer_details',
        title: 'Customer Details',
        data: result,
      }

    case 'get_order_trends':
      return {
        type: 'trend',
        title: 'Order Trends',
        data: result,
      }

    default:
      return undefined
  }
}
