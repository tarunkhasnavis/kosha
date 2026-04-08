import { NextResponse } from 'next/server'
import { getPriceResults } from '@/lib/db'

export async function GET() {
  try {
    const results = await getPriceResults()

    // Build CSV
    const headers = [
      'Store Name',
      'Address',
      'Store Type',
      'Phone',
      'Product',
      'Price',
      'Before Tax',
      'Pack Size',
      'Confidence',
      'Notes',
    ]

    const rows = results.map((r: Record<string, unknown>) => {
      const store = r.indexer_stores as Record<string, string> | null
      return [
        store?.name ?? '',
        store?.address ?? '',
        store?.type ?? '',
        store?.phone ?? '',
        r.product_name,
        r.price ?? '',
        r.before_tax ? 'Yes' : 'No',
        r.pack_size ?? '',
        r.confidence ?? '',
        r.notes ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="seltzer-prices-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to export', details: String(err) },
      { status: 500 },
    )
  }
}
