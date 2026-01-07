'use server'

/**
 * Order Server Actions
 *
 * UI-facing server actions for order management.
 * Called from React components to approve, reject, edit orders.
 */

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import type { OrderStatus } from '@/types/orders'
import { getOrderClarificationInfo, clearClarificationMessage, updateClarificationMessage, getOrderThreadInfo, getOrderLearningData } from './queries'
import { generateApprovalEmail, generateRejectionEmail } from './utils/templates'
import { getUserOrganization, getOrganizationId } from '@/lib/organizations/queries'
import { analyzeOrderCompleteness } from '@/lib/email/parser'
import { sendGmailReply } from '@/lib/email/gmail/reply'
import { replaceOrderItems, type OrderItemInput } from './services'
import { triggerOrderCompleted } from '@/lib/integrations/dispatcher'
import { getOrgRequiredFields } from './field-config'
import { saveOrderExample } from '@/lib/ai/embeddings'

// ============================================
// USER-FACING SERVER ACTIONS (UI interactions)
// ============================================

export async function approveOrder(orderId: string, customEmailMessage?: string) {
  const supabase = await createClient()

  // Get organization for email signature
  const organization = await getUserOrganization()
  if (!organization) {
    throw new Error('No organization found')
  }

  // Get order details with items
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      company_name,
      contact_name,
      order_value,
      expected_date,
      order_items (
        id,
        name,
        sku,
        quantity,
        quantity_unit,
        unit_price,
        total
      )
    `)
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw new Error(`Failed to fetch order: ${orderError?.message}`)
  }

  // Update status to approved
  const { error } = await supabase
    .from('orders')
    .update({ status: 'approved' })
    .eq('id', orderId)

  if (error) throw error

  // Trigger integrations (non-blocking - don't fail if integration fails)
  try {
    // Get original email sender for integration context
    // This helps integrations like WooCommerce skip orders that originated from their platform
    const { data: originalEmail } = await supabase
      .from('order_emails')
      .select('email_from')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    const integrationItems = (order.order_items || []).map((item: any) => ({
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
    }))
    const integrationResults = await triggerOrderCompleted(
      organization.id,
      orderId,
      integrationItems,
      { senderEmail: originalEmail?.email_from || undefined }
    )
    console.log(`[Integrations] Order ${orderId}:`, integrationResults)
  } catch (integrationError) {
    console.error('Error triggering integrations:', integrationError)
    // Don't throw - order is still approved
  }

  // Try to send approval email (non-blocking - don't fail if email fails)
  try {
    const threadInfo = await getOrderThreadInfo(orderId)
    if (threadInfo) {
      // Use custom email message if provided, otherwise generate default
      const emailBody = customEmailMessage || generateApprovalEmail(
        {
          orderNumber: order.order_number,
          companyName: order.company_name || undefined,
          contactName: order.contact_name || undefined,
          items: (order.order_items || []).map((item: any) => ({
            id: item.id,
            order_id: orderId,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            quantity_unit: item.quantity_unit,
            unit_price: item.unit_price,
            total: item.total,
          })),
          orderValue: order.order_value,
          expectedDate: order.expected_date || undefined,
        },
        organization.name || 'Our Team'
      )

      const result = await sendGmailReply(
        threadInfo.threadId,
        emailBody,
        `Re: ${threadInfo.subject}`,
        threadInfo.organizationId
      )

      if (result.success) {
        console.log(`✅ Sent approval email for order ${orderId} (messageId: ${result.messageId})`)
      } else {
        console.error(`⚠️ Failed to send approval email: ${result.error}`)
      }
    } else {
      console.log(`ℹ️ No email thread found for order ${orderId}, skipping approval email`)
    }
  } catch (emailError) {
    console.error('Error sending approval email:', emailError)
    // Don't throw - order is still approved
  }

  // Save as learning example for RAG (non-blocking)
  try {
    const learningData = await getOrderLearningData(orderId)
    if (learningData) {
      // Build the final extracted order from current state
      const extractedOrder = {
        companyName: order.company_name,
        orderNumber: order.order_number,
        orderValue: order.order_value,
        items: (order.order_items || []).map((item: any) => ({
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          quantityUnit: item.quantity_unit,
          unitPrice: item.unit_price,
          total: item.total,
        })),
        contactName: order.contact_name,
        expectedDate: order.expected_date,
      }

      // Determine if order was edited by comparing item counts or values
      // (Simple heuristic - could be more sophisticated)
      const originalItems = learningData.originalExtraction?.items_added as any[] | undefined
      const wasEdited = !originalItems ||
        originalItems.length !== (order.order_items || []).length ||
        order.order_value !== learningData.originalExtraction?.order_value

      const result = await saveOrderExample(
        learningData.rawInput,
        extractedOrder,
        learningData.organizationId,
        orderId,
        wasEdited,
        { senderDomain: learningData.senderDomain, docType: 'email' }
      )

      if (result.success) {
        console.log(`📚 Saved order ${orderId} as learning example (edited: ${wasEdited})`)
      } else {
        console.error(`⚠️ Failed to save learning example: ${result.error}`)
      }
    }
  } catch (learningError) {
    console.error('Error saving learning example:', learningError)
    // Don't throw - order is still approved
  }

  revalidatePath('/orders')
  return { success: true }
}

export async function rejectOrder(orderId: string, reason?: string) {
  const supabase = await createClient()

  // Get organization for email signature
  const organization = await getUserOrganization()
  if (!organization) {
    throw new Error('No organization found')
  }

  // Get order details before deleting
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      company_name,
      contact_name,
      order_value,
      expected_date,
      order_items (
        id,
        name,
        sku,
        quantity,
        quantity_unit,
        unit_price,
        total
      )
    `)
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw new Error(`Failed to fetch order: ${orderError?.message}`)
  }

  // Get thread info before deleting (since order_emails references order)
  const threadInfo = await getOrderThreadInfo(orderId)

  // Delete the order
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId)

  if (error) throw error

  // Try to send rejection email (non-blocking - don't fail if email fails)
  try {
    if (threadInfo) {
      const emailBody = generateRejectionEmail(
        {
          orderNumber: order.order_number,
          companyName: order.company_name || undefined,
          contactName: order.contact_name || undefined,
          items: (order.order_items || []).map((item: any) => ({
            id: item.id,
            order_id: orderId,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            quantity_unit: item.quantity_unit,
            unit_price: item.unit_price,
            total: item.total,
          })),
          orderValue: order.order_value,
          expectedDate: order.expected_date || undefined,
        },
        organization.name || 'Our Team',
        reason
      )

      const result = await sendGmailReply(
        threadInfo.threadId,
        emailBody,
        `Re: ${threadInfo.subject}`,
        threadInfo.organizationId
      )

      if (result.success) {
        console.log(`✅ Sent rejection email for order ${orderId} (messageId: ${result.messageId})`)
      } else {
        console.error(`⚠️ Failed to send rejection email: ${result.error}`)
      }
    } else {
      console.log(`ℹ️ No email thread found for order ${orderId}, skipping rejection email`)
    }
  } catch (emailError) {
    console.error('Error sending rejection email:', emailError)
    // Don't throw - order is still rejected/deleted
  }

  revalidatePath('/orders')
  return { success: true }
}

/**
 * Mark an order's PDF as downloaded
 * Updates the pdf_downloaded_at timestamp
 */
export async function markOrderPdfDownloaded(orderId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update({ pdf_downloaded_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) {
    console.error('Failed to mark PDF as downloaded:', error)
    throw new Error(`Failed to mark PDF as downloaded: ${error.message}`)
  }

  revalidatePath('/orders')
  return { success: true }
}

/**
 * Archive an approved order
 * Moves the order to archived status
 */
export async function archiveOrder(orderId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update({ status: 'archived' })
    .eq('id', orderId)

  if (error) {
    console.error('Failed to archive order:', error)
    throw new Error(`Failed to archive order: ${error.message}`)
  }

  revalidatePath('/orders')
  return { success: true }
}

/**
 * Unarchive an order (restore to approved status)
 */
export async function unarchiveOrder(orderId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update({ status: 'approved' })
    .eq('id', orderId)

  if (error) {
    console.error('Failed to unarchive order:', error)
    throw new Error(`Failed to unarchive order: ${error.message}`)
  }

  revalidatePath('/orders')
  return { success: true }
}

export async function requestOrderInfo(orderId: string, customMessage?: string) {
  // Get the stored clarification info for this order (for thread/subject info)
  const clarificationInfo = await getOrderClarificationInfo(orderId)

  if (!clarificationInfo) {
    throw new Error('No clarification info found for this order. The order may not have an associated email thread.')
  }

  // Use custom message if provided, otherwise use stored message
  const messageToSend = customMessage || clarificationInfo.clarificationMessage

  // Validate that clarification message is not empty
  if (!messageToSend || messageToSend.trim() === '') {
    throw new Error('Clarification message is empty. Cannot send blank email.')
  }

  console.log(`📤 Attempting to send clarification email for order ${orderId}`)

  // Send the clarification email
  const result = await sendGmailReply(
    clarificationInfo.threadId,
    messageToSend,
    `Re: ${clarificationInfo.subject}`,
    clarificationInfo.organizationId
  )

  if (!result.success) {
    throw new Error(`Failed to send clarification email: ${result.error}`)
  }

  // Clear the clarification message so button shows "Request Sent"
  await clearClarificationMessage(orderId)

  console.log(`✅ Sent clarification email for order ${orderId} (messageId: ${result.messageId})`)

  revalidatePath('/orders')
  return { success: true, messageId: result.messageId }
}

/**
 * Save an edited clarification message without sending it
 * Used when user edits the message and clicks "Save for Later"
 */
export async function saveClarificationMessage(orderId: string, message: string) {
  await updateClarificationMessage(orderId, message)
  revalidatePath('/orders')
  return { success: true }
}

// ============================================
// ATOMIC DB OPERATIONS (for internal use)
// ============================================

/**
 * Input type for creating an order
 */
export interface CreateOrderInput {
  order_number: string
  company_name?: string  // Optional - can be missing for incomplete orders awaiting clarification
  source: 'email' | 'text' | 'voicemail' | 'spreadsheet' | 'pdf'
  status: OrderStatus
  order_value: number
  item_count: number
  received_date: string
  expected_date?: string
  notes?: string
  billing_address?: string
  phone?: string
  payment_method?: string
  contact_name?: string
  contact_email?: string
  ship_via?: string  // 'Delivery' or 'Customer Pickup' (empty = not specified)
  organization_id: string
  email_from: string
  email_url?: string
  custom_fields?: Record<string, string | number | null>  // Org-specific fields stored as JSONB
  inferred_fields?: string[]  // Fields where AI made logical leaps (e.g., "items[0].sku", "liquor_license")
  clarification_message?: string | null  // Pending clarification message (null = already sent or not applicable)
}

/**
 * Create a new order in the database
 * Returns the created order with ID
 */
export async function createOrder(input: CreateOrderInput) {
  const supabase = await createClient()

  // Base fields that are always included
  const baseFields = {
    order_number: input.order_number,
    company_name: input.company_name,
    source: input.source,
    status: input.status,
    order_value: input.order_value,
    item_count: input.item_count,
    received_date: input.received_date,
    expected_date: input.expected_date || null,
    notes: input.notes || null,
    billing_address: input.billing_address || null,
    phone: input.phone || null,
    payment_method: input.payment_method || null,
    contact_name: input.contact_name || null,
    contact_email: input.contact_email || null,
    ship_via: input.ship_via || null,
    organization_id: input.organization_id,
    email_from: input.email_from,
    email_url: input.email_url || null,
    inferred_fields: input.inferred_fields || null,
    clarification_message: input.clarification_message || null,
  }

  // Extract org-specific fields (any fields not in the base set)
  const baseFieldKeys = new Set([
    'order_number', 'company_name', 'source', 'status', 'order_value',
    'item_count', 'received_date', 'expected_date', 'notes',
    'billing_address', 'phone', 'payment_method', 'contact_name',
    'contact_email', 'ship_via', 'organization_id', 'email_from', 'email_url',
    'inferred_fields', 'clarification_message'
  ])

  const orgFields: Record<string, string | number | null> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!baseFieldKeys.has(key) && value !== undefined) {
      orgFields[key] = value ?? null
    }
  }

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      ...baseFields,
      ...orgFields,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create order:', error)
    throw new Error(`Failed to create order: ${error.message}`)
  }

  return order
}

/**
 * Update specific fields on an order
 */
export async function updateOrderFields(
  orderId: string,
  fields: {
    order_value?: number
    item_count?: number
    status?: OrderStatus
    expected_date?: string | null
    notes?: string | null
    billing_address?: string | null
    phone?: string | null
    payment_method?: string | null
    contact_name?: string | null
    contact_email?: string | null
    ship_via?: string | null
    custom_fields?: Record<string, string | number | null>  // Org-specific fields
    inferred_fields?: string[] | null  // Fields where AI made logical leaps
    clarification_message?: string | null  // Pending clarification message (null = already sent)
  }
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update(fields)
    .eq('id', orderId)

  if (error) {
    console.error('Failed to update order:', error)
    throw new Error(`Failed to update order: ${error.message}`)
  }
}

// ============================================
// UI SAVE OPERATIONS (for order editing modal)
// ============================================

/**
 * Input type for editable items from the UI
 */
export interface EditableItemInput {
  id: string
  name: string
  sku: string
  quantity: number
  quantity_unit: string
  unit_price: string
  total: number
  isNew?: boolean
}

/**
 * Save all changes to an order (items + order fields + org-specific fields)
 *
 * For "awaiting_clarification" orders:
 * - After saving, we need to re-evaluate if the order is now complete
 * - This will be handled by a separate AI call (TODO: implement re-evaluation)
 * - For now, we just save the changes and keep the status as-is
 *
 * @param orderId - The order to update
 * @param items - The edited items
 * @param orderFields - The edited order-level fields (including org-specific fields)
 */
export async function saveOrderChanges(
  orderId: string,
  items: EditableItemInput[],
  orderFields: {
    notes?: string
    expected_date?: string
    ship_via?: string
    orgFields?: Record<string, string | number | null>
  },
  deletedItemIds?: string[]
) {
  const organizationId = await getOrganizationId()
  if (!organizationId) {
    throw new Error('No organization found')
  }

  const supabase = await createClient()

  // Calculate new totals from items
  const orderValue = items.reduce((sum, item) => sum + item.total, 0)
  const itemCount = items.length

  // Build update object with base fields and custom_fields JSONB
  const updateData: Record<string, unknown> = {
    order_value: orderValue,
    item_count: itemCount,
    notes: orderFields.notes || null,
    expected_date: orderFields.expected_date || null,
    ship_via: orderFields.ship_via || null,
  }

  // Store org-specific fields in custom_fields JSONB column
  if (orderFields.orgFields) {
    updateData.custom_fields = orderFields.orgFields
  }

  // Update order fields (but not status - that's handled separately)
  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)

  if (error) {
    console.error('Failed to update order:', error)
    throw new Error(`Failed to update order: ${error.message}`)
  }

  // Convert editable items to order item inputs (include id for updates)
  const orderItemInputs: OrderItemInput[] = items.map(item => ({
    id: item.isNew ? undefined : item.id,  // Only include id for existing items
    name: item.name,
    sku: item.sku || undefined,
    quantity: item.quantity,
    quantity_unit: item.quantity_unit,
    unit_price: parseFloat(item.unit_price) || 0,
    total: item.total,
  }))

  // Replace all items with the edited ones (soft-delete removed items)
  await replaceOrderItems(orderId, orderItemInputs, organizationId, deletedItemIds)

  // TODO: For "awaiting_clarification" orders, re-evaluate completeness with AI
  // and update status + clarification_message accordingly

  revalidatePath('/orders')
  return { success: true }
}

/**
 * Result type for saveAndAnalyzeOrder
 */
export interface SaveAndAnalyzeResult {
  success: boolean
  isComplete: boolean
  clarificationMessage?: string
  missingInfo?: string[]
}

/**
 * Save changes and analyze order completeness with AI.
 * Used for "awaiting_clarification" orders when user makes edits.
 *
 * Flow:
 * 1. Save the item edits to database
 * 2. Call AI to check if order is now complete
 * 3. If incomplete: Generate new clarification message, keep status as awaiting_clarification
 * 4. If complete: Update status to waiting_review
 * 5. Return result with isComplete flag and clarification message (if any)
 */
export async function saveAndAnalyzeOrder(
  orderId: string,
  items: EditableItemInput[],
  orderFields: {
    notes?: string
    expected_date?: string
    ship_via?: string
    orgFields?: Record<string, string | number | null>
  },
  deletedItemIds?: string[]
): Promise<SaveAndAnalyzeResult> {
  const organizationId = await getOrganizationId()
  if (!organizationId) {
    throw new Error('No organization found')
  }

  const supabase = await createClient()

  // Get current order info (all fields - we need org-specific fields dynamically)
  const { data: currentOrder, error: fetchError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (fetchError || !currentOrder) {
    throw new Error('Failed to fetch order')
  }

  // Get organization's required fields config, system prompt, and name
  const { data: orgData } = await supabase
    .from('organizations')
    .select('name, required_order_fields, system_prompt')
    .eq('id', organizationId)
    .single()

  const orgRequiredFields = getOrgRequiredFields(orgData?.required_order_fields)
  const orgSystemPrompt = orgData?.system_prompt || null
  const organizationName = orgData?.name || undefined

  // Calculate new totals from items
  const orderValue = items.reduce((sum, item) => sum + item.total, 0)
  const itemCount = items.length

  // Convert editable items to format for AI analysis
  const itemsForAnalysis = items.map(item => ({
    name: item.name,
    sku: item.sku || undefined,
    quantity: item.quantity,
    quantity_unit: item.quantity_unit,
    unit_price: parseFloat(item.unit_price) || 0,
    total: item.total,
  }))

  // Merge user's org field edits with current order's custom_fields for completeness check
  const mergedOrderData: Record<string, unknown> = {
    ...currentOrder,
    custom_fields: {
      ...(currentOrder.custom_fields as Record<string, unknown> || {}),
      ...(orderFields.orgFields || {}),
    },
  }

  // Call AI to analyze completeness (including org-specific required fields and prompt)
  const analysisResult = await analyzeOrderCompleteness(
    itemsForAnalysis,
    currentOrder.company_name || undefined,
    undefined, // originalMissingInfo - not available here
    mergedOrderData, // order data with user's org field edits
    orgRequiredFields,
    orgSystemPrompt,
    currentOrder.contact_name || undefined, // contactName for email greeting
    organizationName // organizationName for email signature
  )

  // Determine new status based on completeness
  const newStatus: OrderStatus = analysisResult.isComplete ? 'waiting_review' : 'awaiting_clarification'

  // Build update object with base fields and custom_fields JSONB
  const updateData: Record<string, unknown> = {
    order_value: orderValue,
    item_count: itemCount,
    notes: orderFields.notes || null,
    expected_date: orderFields.expected_date || null,
    ship_via: orderFields.ship_via || null,
    status: newStatus,
  }

  // Store org-specific fields in custom_fields JSONB column
  if (orderFields.orgFields) {
    updateData.custom_fields = orderFields.orgFields
  }

  // Update order fields and status
  const { error: updateError } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)

  if (updateError) {
    throw new Error(`Failed to update order: ${updateError.message}`)
  }

  // Convert editable items to order item inputs (include id for updates)
  const orderItemInputs: OrderItemInput[] = items.map(item => ({
    id: item.isNew ? undefined : item.id,  // Only include id for existing items
    name: item.name,
    sku: item.sku || undefined,
    quantity: item.quantity,
    quantity_unit: item.quantity_unit,
    unit_price: parseFloat(item.unit_price) || 0,
    total: item.total,
  }))

  // Replace all items with the edited ones (soft-delete removed items)
  await replaceOrderItems(orderId, orderItemInputs, organizationId, deletedItemIds)

  // If incomplete, update the clarification message on the order
  if (!analysisResult.isComplete && analysisResult.clarificationEmail) {
    await updateClarificationMessage(orderId, analysisResult.clarificationEmail)
  } else if (analysisResult.isComplete) {
    // If complete, clear any existing clarification message
    await clearClarificationMessage(orderId)
  }

  revalidatePath('/orders')

  return {
    success: true,
    isComplete: analysisResult.isComplete,
    clarificationMessage: analysisResult.clarificationEmail,
    missingInfo: analysisResult.missingInfo,
  }
}

/**
 * Save changes and approve the order
 */
export async function saveAndApproveOrder(
  orderId: string,
  items: EditableItemInput[],
  orderFields: {
    notes?: string
    expected_date?: string
    ship_via?: string
    orgFields?: Record<string, string | number | null>
  },
  customApprovalEmail?: string,
  deletedItems?: EditableItemInput[]
) {
  const organizationId = await getOrganizationId()
  if (!organizationId) {
    throw new Error('No organization found')
  }

  // Calculate new totals from items
  const orderValue = items.reduce((sum, item) => sum + item.total, 0)
  const itemCount = items.length

  const supabase = await createClient()

  // Build update object with base fields and custom_fields JSONB
  const updateData: Record<string, unknown> = {
    order_value: orderValue,
    item_count: itemCount,
    notes: orderFields.notes || null,
    expected_date: orderFields.expected_date || null,
    ship_via: orderFields.ship_via || null,
    status: 'approved',
  }

  // Store org-specific fields in custom_fields JSONB column
  if (orderFields.orgFields) {
    updateData.custom_fields = orderFields.orgFields
  }

  // Update order fields AND status in one call
  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)

  if (error) {
    throw new Error(`Failed to save and approve order: ${error.message}`)
  }

  // Convert editable items to order item inputs (include id for updates)
  const orderItemInputs: OrderItemInput[] = items.map(item => ({
    id: item.isNew ? undefined : item.id,  // Only include id for existing items
    name: item.name,
    sku: item.sku || undefined,
    quantity: item.quantity,
    quantity_unit: item.quantity_unit,
    unit_price: parseFloat(item.unit_price) || 0,
    total: item.total,
  }))

  // Extract IDs from deleted items
  const deletedItemIds = deletedItems
    ?.filter(item => !item.isNew && item.id)
    .map(item => item.id) || []

  // Replace all items with the edited ones (soft-delete removed items)
  await replaceOrderItems(orderId, orderItemInputs, organizationId, deletedItemIds)

  // Send approval email (non-blocking - don't fail if email fails)
  try {
    const organization = await getUserOrganization()
    const threadInfo = await getOrderThreadInfo(orderId)

    if (threadInfo && organization) {
      // Get updated order for email (with new items)
      const { data: updatedOrder } = await supabase
        .from('orders')
        .select(`
          order_number,
          company_name,
          contact_name,
          order_value,
          expected_date,
          order_items (
            id,
            name,
            sku,
            quantity,
            quantity_unit,
            unit_price,
            total
          )
        `)
        .eq('id', orderId)
        .single()

      if (updatedOrder) {
        // Convert deleted items for email if provided
        const deletedItemsForEmail = deletedItems
          ? deletedItems.map(item => ({
              id: item.id || '',
              order_id: orderId,
              name: item.name,
              sku: item.sku || '',
              quantity: item.quantity,
              quantity_unit: item.quantity_unit,
              unit_price: parseFloat(item.unit_price) || 0,
              total: item.total,
            }))
          : undefined

        // Use custom email if provided, otherwise generate default
        const emailBody = customApprovalEmail || generateApprovalEmail(
          {
            orderNumber: updatedOrder.order_number,
            companyName: updatedOrder.company_name || undefined,
            contactName: updatedOrder.contact_name || undefined,
            items: (updatedOrder.order_items || []).map((item: any) => ({
              id: item.id,
              order_id: orderId,
              name: item.name,
              sku: item.sku,
              quantity: item.quantity,
              quantity_unit: item.quantity_unit,
              unit_price: item.unit_price,
              total: item.total,
            })),
            deletedItems: deletedItemsForEmail,
            orderValue: updatedOrder.order_value,
            expectedDate: updatedOrder.expected_date || undefined,
          },
          organization.name || 'Our Team'
        )

        const result = await sendGmailReply(
          threadInfo.threadId,
          emailBody,
          `Re: ${threadInfo.subject}`,
          threadInfo.organizationId
        )

        if (result.success) {
          console.log(`✅ Sent approval email for order ${orderId} (messageId: ${result.messageId})`)
        } else {
          console.error(`⚠️ Failed to send approval email: ${result.error}`)
        }
      }
    }
  } catch (emailError) {
    console.error('Error sending approval email:', emailError)
    // Don't throw - order is still approved
  }

  revalidatePath('/orders')
  return { success: true }
}

// ============================================
// MANUAL ORDER CREATION (UI form submission)
// ============================================

/**
 * Input type for manually creating an order from the UI
 */
export interface ManualOrderInput {
  company_name: string
  contact_name?: string
  contact_email?: string
  phone?: string
  expected_date?: string
  ship_via?: string
  notes?: string
  items: {
    name: string
    sku?: string
    quantity: number
    quantity_unit: string
    unit_price: number
  }[]
}

/**
 * Manually create a new order from the UI
 * Used when user clicks "Add Order" button
 */
export async function createManualOrder(input: ManualOrderInput) {
  const organizationId = await getOrganizationId()
  if (!organizationId) {
    return { error: 'No organization found' }
  }

  const supabase = await createClient()

  // Generate order number (ORD-YYYYMMDD-XXXX format)
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  const orderNumber = `ORD-${dateStr}-${randomSuffix}`

  // Calculate totals
  const orderValue = input.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  const itemCount = input.items.length

  try {
    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        company_name: input.company_name,
        contact_name: input.contact_name || null,
        contact_email: input.contact_email || null,
        phone: input.phone || null,
        source: 'spreadsheet', // Manual entry treated as spreadsheet source
        status: 'waiting_review',
        order_value: orderValue,
        item_count: itemCount,
        received_date: today.toISOString(),
        expected_date: input.expected_date || null,
        ship_via: input.ship_via || null,
        notes: input.notes || null,
        organization_id: organizationId,
        email_from: 'manual-entry',
      })
      .select()
      .single()

    if (orderError) {
      console.error('Failed to create order:', orderError)
      return { error: `Failed to create order: ${orderError.message}` }
    }

    // Create order items
    const orderItems = input.items.map(item => ({
      order_id: order.id,
      organization_id: organizationId,
      name: item.name,
      sku: item.sku || null,
      quantity: item.quantity,
      quantity_unit: item.quantity_unit,
      unit_price: item.unit_price,
      total: item.quantity * item.unit_price,
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Failed to create order items:', itemsError)
      // Rollback the order
      await supabase.from('orders').delete().eq('id', order.id)
      return { error: `Failed to create order items: ${itemsError.message}` }
    }

    revalidatePath('/orders')
    return { order }
  } catch (err) {
    console.error('Error creating manual order:', err)
    return { error: 'An unexpected error occurred' }
  }
}

// ============================================
// APPROVAL EMAIL PREVIEW
// ============================================

/**
 * Generate a preview of the approval email that would be sent.
 * Used by the UI to show an editable email before approving.
 *
 * @param orderId - The order ID to fetch details for
 * @param uiItems - Optional current items from UI state (if user has made edits)
 * @param deletedItems - Optional deleted items from UI state (to include in email)
 */
export async function generateApprovalEmailPreview(
  orderId: string,
  uiItems?: EditableItemInput[],
  deletedItems?: EditableItemInput[]
): Promise<string | null> {
  const supabase = await createClient()

  // Get organization for email signature
  const organization = await getUserOrganization()
  if (!organization) {
    return null
  }

  // Get order details with items
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      company_name,
      contact_name,
      order_value,
      expected_date,
      order_items (
        id,
        name,
        sku,
        quantity,
        quantity_unit,
        unit_price,
        total
      )
    `)
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    console.error('Failed to fetch order for email preview:', orderError)
    return null
  }

  // Use UI items if provided, otherwise use database items
  const itemsForEmail = uiItems
    ? uiItems.map(item => ({
        id: item.id || '',
        order_id: orderId,
        name: item.name,
        sku: item.sku || '',
        quantity: item.quantity,
        quantity_unit: item.quantity_unit,
        unit_price: parseFloat(item.unit_price) || 0,
        total: item.total,
      }))
    : (order.order_items || []).map((item: any) => ({
        id: item.id,
        order_id: orderId,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        quantity_unit: item.quantity_unit,
        unit_price: item.unit_price,
        total: item.total,
      }))

  // Convert deleted items if provided
  const deletedItemsForEmail = deletedItems
    ? deletedItems.map(item => ({
        id: item.id || '',
        order_id: orderId,
        name: item.name,
        sku: item.sku || '',
        quantity: item.quantity,
        quantity_unit: item.quantity_unit,
        unit_price: parseFloat(item.unit_price) || 0,
        total: item.total,
      }))
    : undefined

  // Calculate order value from UI items if provided
  const orderValue = uiItems
    ? uiItems.reduce((sum, item) => sum + item.total, 0)
    : order.order_value

  return generateApprovalEmail(
    {
      orderNumber: order.order_number,
      companyName: order.company_name || undefined,
      contactName: order.contact_name || undefined,
      items: itemsForEmail,
      deletedItems: deletedItemsForEmail,
      orderValue: orderValue,
      expectedDate: order.expected_date || undefined,
    },
    organization.name || 'Our Team'
  )
}
