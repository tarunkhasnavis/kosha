'use server'

/**
 * Insight Actions
 *
 * Mutations for insight management.
 */

import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { revalidatePath } from 'next/cache'

/**
 * Delete an insight.
 */
export async function deleteInsight(
  insightId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('insights')
    .delete()
    .eq('id', insightId)

  if (error) {
    console.error('Failed to delete insight:', error)
    return { success: false, error: 'Failed to delete insight' }
  }

  revalidatePath('/capture')
  revalidatePath('/territory')
  return { success: true }
}
