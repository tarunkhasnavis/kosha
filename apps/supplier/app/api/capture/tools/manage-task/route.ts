import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createClient } from '@kosha/supabase/server'
import { createTask, updateTask, deleteTask, toggleTaskCompleted } from '@/lib/tasks/actions'

/**
 * POST /api/capture/tools/manage-task
 *
 * Create, update, delete, or complete tasks.
 * Called by the voice agent when the LLM invokes the manage_task tool.
 */
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const orgId = await getOrganizationId()
  if (!orgId) {
    return NextResponse.json({ error: 'No organization found' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { action, account_name, task, priority, due_date, task_id } = body as {
    action?: 'create' | 'update' | 'delete' | 'complete'
    account_name?: string
    task?: string
    priority?: 'high' | 'medium' | 'low'
    due_date?: string
    task_id?: string
  }

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 })
  }

  if (!account_name) {
    return NextResponse.json({ error: 'account_name is required' }, { status: 400 })
  }

  const supabase = await createClient()

  if (action === 'create') {
    if (!task) {
      return NextResponse.json({ error: 'task description is required' }, { status: 400 })
    }

    // Find the account by name
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('organization_id', orgId)
      .ilike('name', `%${account_name}%`)
      .limit(1)

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: `No account found matching "${account_name}".` })
    }

    const account = accounts[0]
    const taskPriority = priority || 'medium'
    const daysOut = taskPriority === 'high' ? 2 : taskPriority === 'medium' ? 7 : 14
    const taskDueDate = due_date || new Date(Date.now() + daysOut * 86400000).toISOString().split('T')[0]

    const result = await createTask({
      accountId: account.id,
      accountName: account.name,
      task,
      dueDate: taskDueDate,
      priority: taskPriority,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'created',
      account_name: account.name,
      task,
      priority: taskPriority,
      due_date: taskDueDate,
      message: `Task created for ${account.name}: "${task}" [${taskPriority}] due ${new Date(taskDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`,
    })
  }

  if (action === 'update') {
    if (!task_id) {
      return NextResponse.json({ error: 'task_id is required for update. Use get_account_details to find task IDs.' }, { status: 400 })
    }

    const result = await updateTask(task_id, {
      task: task || undefined,
      dueDate: due_date || undefined,
      priority: priority || undefined,
    })

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'updated',
      task_id,
      message: 'Task updated.',
    })
  }

  if (action === 'delete') {
    if (!task_id) {
      return NextResponse.json({ error: 'task_id is required for deletion.' }, { status: 400 })
    }

    const result = await deleteTask(task_id)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'deleted',
      message: 'Task deleted.',
    })
  }

  if (action === 'complete') {
    if (!task_id) {
      return NextResponse.json({ error: 'task_id is required for completion.' }, { status: 400 })
    }

    const result = await toggleTaskCompleted(task_id, true)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      action: 'completed',
      message: 'Task marked as complete.',
    })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
