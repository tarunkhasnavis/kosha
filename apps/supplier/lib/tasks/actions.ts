'use server'

/**
 * Task Actions
 *
 * Mutations for follow-up task management.
 */

import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { revalidatePath } from 'next/cache'

/**
 * Toggle a task's completed status.
 */
export async function toggleTaskCompleted(
  taskId: string,
  completed: boolean
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('tasks')
    .update({ completed })
    .eq('id', taskId)

  if (error) {
    console.error('Failed to update task:', error)
    return { success: false, error: 'Failed to update task' }
  }

  revalidatePath('/accounts')
  return { success: true }
}

/**
 * Delete a task.
 */
export async function deleteTask(
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) {
    console.error('Failed to delete task:', error)
    return { success: false, error: 'Failed to delete task' }
  }

  revalidatePath('/accounts')
  return { success: true }
}
