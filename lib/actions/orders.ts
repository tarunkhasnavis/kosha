'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function approveOrder(orderId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update({ status: 'approved' })
    .eq('id', orderId)

  if (error) throw error

  revalidatePath('/orders')
  return { success: true }
}

export async function rejectOrder(orderId: string, reason?: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId)

  if (error) throw error

  revalidatePath('/orders')
  return { success: true }
}

export async function requestOrderInfo(orderId: string, recipientEmail: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update({ status: 'info_requested' })
    .eq('id', orderId)

  if (error) throw error

  revalidatePath('/orders')
  return { success: true }
}
