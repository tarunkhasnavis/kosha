import { NextRequest, NextResponse } from 'next/server'

// POST — add a store manually
export async function POST(req: NextRequest) {
  try {
    const { name, phone, address, type } = await req.json()

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 })
    }

    // Clean phone number
    const digits = phone.replace(/\D/g, '')
    const cleanPhone = digits.length === 10 ? `+1${digits}` : digits.startsWith('1') && digits.length === 11 ? `+${digits}` : phone

    const store = {
      id: `manual-${Date.now()}`,
      name,
      phone: cleanPhone,
      address: address || 'Manually added',
      lat: 41.8781 + (Math.random() - 0.5) * 0.05,
      lng: -87.6298 + (Math.random() - 0.5) * 0.05,
      type: type || 'other',
      place_id: `manual-${Date.now()}`,
    }

    return NextResponse.json({ ok: true, store })
  } catch (err) {
    return NextResponse.json({ error: 'Unexpected error', details: String(err) }, { status: 500 })
  }
}
