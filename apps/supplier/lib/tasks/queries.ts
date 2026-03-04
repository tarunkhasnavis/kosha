/**
 * Task Queries
 *
 * Read-only operations for follow-up tasks.
 * RLS handles rep vs admin visibility automatically.
 */

import { createClient } from '@kosha/supabase/server'
import { getOrganizationId } from '@/lib/auth'
import type { Task } from '@kosha/types'

/**
 * Get tasks for a specific account.
 * Incomplete tasks first, sorted by due date.
 */
export async function getTasksForAccount(
  accountId: string
): Promise<{ tasks: Task[]; error?: string }> {
  const orgId = await getOrganizationId()
  if (!orgId) return { tasks: [], error: 'No organization found' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('account_id', accountId)
    .order('completed', { ascending: true })
    .order('due_date', { ascending: true })

  if (error) {
    console.error('Failed to fetch tasks for account:', error)
    return { tasks: [], error: 'Failed to fetch tasks' }
  }

  return { tasks: (data as Task[]) || [] }
}

/**
 * Get count of incomplete tasks (for dashboard).
 */
export async function getPendingTaskCount(): Promise<number> {
  const orgId = await getOrganizationId()
  if (!orgId) return 0

  const supabase = await createClient()
  const { count, error } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('completed', false)

  if (error) {
    console.error('Failed to count tasks:', error)
    return 0
  }

  return count || 0
}
