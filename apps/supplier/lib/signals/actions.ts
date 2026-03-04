'use server'

/**
 * Signal Actions
 *
 * Mutations for signal management.
 */

import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { revalidatePath } from 'next/cache'

/**
 * Delete a signal.
 */
export async function deleteSignal(
  signalId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('signals')
    .delete()
    .eq('id', signalId)

  if (error) {
    console.error('Failed to delete signal:', error)
    return { success: false, error: 'Failed to delete signal' }
  }

  revalidatePath('/capture')
  revalidatePath('/dashboard')
  revalidatePath('/accounts')
  return { success: true }
}
