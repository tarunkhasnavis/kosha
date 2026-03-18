'use server'

/**
 * Task Actions
 *
 * Mutations for follow-up task management.
 */

import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { scoreAccount } from '@/lib/scoring/actions'

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

  const { data: task, error } = await supabase
    .from('tasks')
    .update({ completed })
    .eq('id', taskId)
    .select('account_id')
    .single()

  if (error) {
    console.error('Failed to update task:', error)
    return { success: false, error: 'Failed to update task' }
  }

  // Recompute account score after task status change
  if (task?.account_id) {
    scoreAccount(task.account_id).catch((err) =>
      console.error('Background score computation failed:', err)
    )
  }

  revalidatePath('/territory')
  revalidatePath('/next-steps')
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

  revalidatePath('/territory')
  return { success: true }
}

/**
 * Update a task's text, due date, or priority.
 */
export async function updateTask(
  taskId: string,
  input: { task?: string; dueDate?: string; priority?: 'high' | 'medium' | 'low' }
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const supabase = await createClient()

  const updates: Record<string, unknown> = {}
  if (input.task !== undefined) updates.task = input.task
  if (input.dueDate !== undefined) updates.due_date = input.dueDate
  if (input.priority !== undefined) updates.priority = input.priority

  if (Object.keys(updates).length === 0) return { success: true }

  const { error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)

  if (error) {
    console.error('Failed to update task:', error)
    return { success: false, error: 'Failed to update task' }
  }

  revalidatePath('/next-steps')
  revalidatePath('/territory')
  return { success: true }
}

/**
 * Create a new task.
 */
export async function createTask(input: {
  accountId: string
  accountName: string
  task: string
  dueDate: string
  priority: 'high' | 'medium' | 'low'
}): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const orgId = await getOrganizationId()
  if (!orgId) return { success: false, error: 'No organization found' }

  const supabase = await createClient()

  const { error } = await supabase.from('tasks').insert({
    organization_id: orgId,
    account_id: input.accountId,
    account_name: input.accountName,
    task: input.task,
    due_date: input.dueDate,
    priority: input.priority,
    completed: false,
  })

  if (error) {
    console.error('Failed to create task:', error)
    return { success: false, error: 'Failed to create task' }
  }

  revalidatePath('/next-steps')
  revalidatePath('/territory')
  return { success: true }
}
