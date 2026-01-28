/**
 * Onboarding Chat API
 *
 * POST - Send message to onboarding AI agent
 *
 * Handles:
 * - File uploads (CSV, Excel, images, PDFs)
 * - Text messages
 * - Action button clicks
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import {
  getOnboardingSession,
  updateOnboardingSession,
  importOnboardingProducts,
  advanceOnboardingStage,
} from '@/lib/onboarding/actions'
import {
  callOnboardingAgent,
  getStageGreeting,
  updateChatSummary,
} from '@/lib/onboarding/agent'
import { processOnboardingFile } from '@/lib/onboarding/file-processor'
import {
  OnboardingChatRequest,
  ChatMessage,
  OnboardingActionId,
  validateStageComplete,
  ExtractedProduct,
} from '@/lib/onboarding/types'

/**
 * POST /api/onboarding/chat
 * Send a message to the onboarding AI agent
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let requestId = ''

  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = (await request.json()) as OnboardingChatRequest
    requestId = body.request_id || crypto.randomUUID()

    const { session_id, message, stage, attachments, action } = body

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
    }

    // Get current session
    const { session, error: sessionError } = await getOnboardingSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError || 'Session not found' }, { status: 404 })
    }

    // Verify session belongs to user
    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Process file attachments if any
    let processedFile = null
    let imageBase64: string | undefined
    let imageMimeType: string | undefined
    let parsedProducts: ExtractedProduct[] | undefined
    let pdfText: string | undefined

    if (attachments && attachments.length > 0) {
      const attachment = attachments[0] // Process first attachment
      processedFile = await processOnboardingFile(
        attachment.content,
        attachment.name,
        attachment.type
      )

      if (processedFile.base64 && processedFile.type === 'image') {
        imageBase64 = processedFile.base64
        imageMimeType = processedFile.mimeType
      }

      if (processedFile.products) {
        parsedProducts = processedFile.products
      }

      if (processedFile.pdfText) {
        pdfText = processedFile.pdfText
      }
    }

    // Handle action button clicks (structured actions)
    if (action) {
      return await handleAction(
        session,
        action,
        requestId,
        startTime,
        parsedProducts,
        message
      )
    }

    // Build user message for chat history
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date(),
      attachment: attachments?.[0] ? {
        name: attachments[0].name,
        type: attachments[0].type,
        size: attachments[0].content.length,
      } : undefined,
    }

    // Extract previously extracted products from recent messages for corrections
    // Look for the most recent message with product_preview richContent
    let previouslyExtractedProducts: ExtractedProduct[] | undefined
    for (let i = session.lastMessages.length - 1; i >= 0; i--) {
      const msg = session.lastMessages[i]
      if (msg.richContent?.type === 'product_preview' && Array.isArray(msg.richContent.data)) {
        previouslyExtractedProducts = msg.richContent.data as ExtractedProduct[]
        break
      }
    }

    // Call AI agent
    const agentResult = await callOnboardingAgent({
      stage: stage || session.currentStage,
      userMessage: message,
      chatSummary: session.chatSummary,
      recentMessages: session.lastMessages,
      imageBase64,
      imageMimeType,
      parsedData: {
        products: parsedProducts,
        pdfText,
      },
      previouslyExtractedProducts,
    })

    // Log the request
    console.log('[Onboarding Chat]', {
      request_id: requestId,
      session_id,
      user_id: user.id,
      stage: stage || session.currentStage,
      model: agentResult.model,
      input_tokens: agentResult.inputTokens,
      output_tokens: agentResult.outputTokens,
      latency_ms: agentResult.latencyMs,
      success: agentResult.success,
      has_attachments: !!attachments?.length,
    })

    if (!agentResult.success || !agentResult.response) {
      // Return error as AI message
      const errorMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `I encountered an issue processing your request. ${agentResult.error || 'Please try again.'}`,
        timestamp: new Date(),
      }

      return NextResponse.json({
        request_id: requestId,
        message: errorMessage,
        session: {
          currentStage: session.currentStage,
          productsImported: session.productsImported,
          orderExampleSaved: session.orderExampleSaved,
        },
        error: agentResult.error,
      })
    }

    // Build AI response message
    const aiResponse = agentResult.response
    const aiMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: aiResponse.message,
      timestamp: new Date(),
      richContent: aiResponse.extractedData?.products ? {
        type: 'product_preview',
        data: aiResponse.extractedData.products,
      } : aiResponse.extractedData?.orderExtraction ? {
        type: 'order_extraction',
        data: aiResponse.extractedData.orderExtraction,
      } : undefined,
      actions: aiResponse.suggestedActions,
    }

    // Update session with new messages (keep last 8)
    const newMessages = [...session.lastMessages, userMessage, aiMessage].slice(-8)
    const newSummary = updateChatSummary(
      session.chatSummary,
      session.currentStage,
      session.productsImported
    )

    await updateOnboardingSession(session.id, {
      lastMessages: newMessages,
      chatSummary: newSummary,
    })

    return NextResponse.json({
      request_id: requestId,
      message: aiMessage,
      session: {
        currentStage: session.currentStage,
        productsImported: session.productsImported,
        orderExampleSaved: session.orderExampleSaved,
      },
    })
  } catch (error) {
    console.error('[Onboarding Chat] Error:', error)
    return NextResponse.json(
      {
        request_id: requestId,
        error: error instanceof Error ? error.message : 'Internal error',
      },
      { status: 500 }
    )
  }
}

/**
 * Handle structured action button clicks
 */
async function handleAction(
  session: NonNullable<Awaited<ReturnType<typeof getOnboardingSession>>['session']>,
  action: OnboardingActionId,
  requestId: string,
  startTime: number,
  parsedProducts?: ExtractedProduct[],
  rawInput?: string
): Promise<NextResponse> {
  console.log('[Onboarding Chat] Action:', {
    request_id: requestId,
    session_id: session.id,
    action,
    stage: session.currentStage,
  })

  // Validate stage completion
  const isComplete = validateStageComplete(
    session.currentStage,
    action,
    session.productsImported
  )

  let responseMessage: ChatMessage
  let updatedSession = { ...session }

  switch (action) {
    case 'confirm_products_import': {
      // Get products from the most recent message with product_preview richContent
      // This ensures we import the latest extracted/corrected products
      let products: ExtractedProduct[] = parsedProducts || []

      if (products.length === 0) {
        // Look for products in the most recent message with product_preview
        for (let i = session.lastMessages.length - 1; i >= 0; i--) {
          const msg = session.lastMessages[i]
          if (msg.richContent?.type === 'product_preview' && Array.isArray(msg.richContent.data)) {
            products = msg.richContent.data as ExtractedProduct[]
            break
          }
        }
      }

      if (products.length > 0) {
        const result = await importOnboardingProducts(session.id, products)

        if (result.success) {
          updatedSession.productsImported = (session.productsImported || 0) + result.imported
          responseMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: `Great! I've imported ${result.imported} products to your catalog. You're all set!`,
            timestamp: new Date(),
          }
        } else {
          responseMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: `There was an issue importing the products: ${result.error}. Would you like to try again?`,
            timestamp: new Date(),
            actions: [
              { id: 'confirm_products_import', label: 'Try again' },
              { id: 'skip_products', label: 'Skip for now' },
            ],
          }
          return NextResponse.json({
            request_id: requestId,
            message: responseMessage,
            session: {
              currentStage: session.currentStage,
              productsImported: session.productsImported,
              orderExampleSaved: session.orderExampleSaved,
            },
          })
        }
      } else {
        responseMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `No products were found to import. Please upload a file or paste your product list.`,
          timestamp: new Date(),
        }
        return NextResponse.json({
          request_id: requestId,
          message: responseMessage,
          session: {
            currentStage: session.currentStage,
            productsImported: session.productsImported,
            orderExampleSaved: session.orderExampleSaved,
          },
        })
      }
      break
    }

    case 'skip_products': {
      responseMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `No problem! You can always add products later from the Products page. You're all set!`,
        timestamp: new Date(),
      }
      break
    }

    case 'add_more_products': {
      responseMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `Sure! Upload another file or paste more products and I'll add them to your catalog.`,
        timestamp: new Date(),
      }
      return NextResponse.json({
        request_id: requestId,
        message: responseMessage,
        session: {
          currentStage: session.currentStage,
          productsImported: session.productsImported,
          orderExampleSaved: session.orderExampleSaved,
        },
      })
    }

    case 'edit_products': {
      responseMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `No problem! Please provide the corrected information and I'll update my extraction.`,
        timestamp: new Date(),
      }
      return NextResponse.json({
        request_id: requestId,
        message: responseMessage,
        session: {
          currentStage: session.currentStage,
          productsImported: session.productsImported,
          orderExampleSaved: session.orderExampleSaved,
        },
      })
    }

    default:
      responseMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `I'm not sure how to handle that action. Please try again.`,
        timestamp: new Date(),
      }
      return NextResponse.json({
        request_id: requestId,
        message: responseMessage,
        session: {
          currentStage: session.currentStage,
          productsImported: session.productsImported,
          orderExampleSaved: session.orderExampleSaved,
        },
      })
  }

  // Advance to next stage if action completes current stage
  if (isComplete) {
    const { nextStage } = await advanceOnboardingStage(session.id, session.currentStage)
    if (nextStage) {
      updatedSession.currentStage = nextStage

      // Add greeting for next stage if not complete
      if (nextStage !== 'complete') {
        responseMessage = getStageGreeting(nextStage)
      } else {
        responseMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `Congratulations! Your onboarding is complete. You're ready to start processing orders. Redirecting you to your orders dashboard...`,
          timestamp: new Date(),
        }
      }
    }
  }

  // Update session messages
  const newMessages = [...session.lastMessages, responseMessage].slice(-8)
  await updateOnboardingSession(session.id, {
    lastMessages: newMessages,
    productsImported: updatedSession.productsImported,
    orderExampleSaved: updatedSession.orderExampleSaved,
    currentStage: updatedSession.currentStage,
  })

  return NextResponse.json({
    request_id: requestId,
    message: responseMessage,
    session: {
      currentStage: updatedSession.currentStage,
      productsImported: updatedSession.productsImported,
      orderExampleSaved: updatedSession.orderExampleSaved,
    },
  })
}
