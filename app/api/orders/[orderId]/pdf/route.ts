/**
 * Order PDF Download API Route
 *
 * GET /api/orders/[orderId]/pdf?type=order_form|invoice
 *
 * Downloads a formatted PDF of the order for the authenticated user.
 * Only accessible for orders belonging to the user's organization.
 * Supports both order form and invoice document types.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getOrganizationId, getOrganizationForPdf } from '@/lib/organizations/queries'
import { generateOrderPdf, type DocumentType } from '@/lib/orders/utils/pdf'
import type { Order, OrderItem } from '@/types/orders'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const { searchParams } = new URL(request.url)
    const documentType = (searchParams.get('type') as DocumentType) || 'order_form'

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    // Get the user's organization
    const organizationId = await getOrganizationId()
    if (!organizationId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = await createClient()

    // Fetch the order with items, ensuring it belongs to the user's organization
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        company_name,
        source,
        status,
        received_date,
        expected_date,
        order_value,
        item_count,
        notes,
        billing_address,
        phone,
        payment_method,
        contact_name,
        contact_email,
        email_url,
        ship_via,
        custom_fields,
        include_notes_in_pdf,
        order_items (
          id,
          order_id,
          name,
          sku,
          quantity,
          quantity_unit,
          unit_price,
          total
        )
      `)
      .eq('id', orderId)
      .eq('organization_id', organizationId)
      .single()

    if (orderError || !order) {
      console.error('Failed to fetch order:', orderError)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Get organization info for the PDF header
    const orgInfo = await getOrganizationForPdf(organizationId)
    if (!orgInfo) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Transform the data to match our types
    const orderData: Order = {
      id: order.id,
      order_number: order.order_number,
      company_name: order.company_name,
      source: order.source,
      status: order.status,
      received_date: order.received_date,
      expected_date: order.expected_date,
      order_value: order.order_value,
      item_count: order.item_count,
      notes: order.notes,
      billing_address: order.billing_address,
      phone: order.phone,
      payment_method: order.payment_method,
      contact_name: order.contact_name,
      contact_email: order.contact_email,
      email_url: order.email_url,
      ship_via: order.ship_via,
      custom_fields: order.custom_fields,
      include_notes_in_pdf: order.include_notes_in_pdf,
    }

    const items: OrderItem[] = (order.order_items || []).map((item: any) => ({
      id: item.id,
      order_id: item.order_id,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      quantity_unit: item.quantity_unit,
      unit_price: item.unit_price,
      total: item.total,
    }))

    // Generate the PDF (only include notes if checkbox was checked)
    const pdfBytes = await generateOrderPdf({
      order: orderData,
      items,
      org: orgInfo,
      includeNotes: order.include_notes_in_pdf ?? false,
      documentType,
    })

    // Create a safe filename
    const safeOrderNumber = order.order_number.replace(/[^a-zA-Z0-9-_]/g, '_')
    const prefix = documentType === 'invoice' ? 'Invoice' : 'Order'
    const filename = `${prefix}_${safeOrderNumber}.pdf`

    // Return the PDF as a downloadable file
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
