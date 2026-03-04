import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

/**
 * POST /api/capture/save
 *
 * Persists signals and tasks extracted by the voice agent.
 * Accepts multiple signals and tasks from a single conversation.
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

  const body = await request.json()
  const { account_id, account_name, signals, tasks, transcript } = body

  if (!account_id || !account_name || !signals?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()
  const captureId = crypto.randomUUID()

  // Insert capture record (transcript storage)
  if (transcript) {
    const { error: captureError } = await supabase
      .from('captures')
      .insert({
        id: captureId,
        user_id: user.id,
        organization_id: orgId,
        account_id,
        account_name,
        transcript,
      })

    if (captureError) {
      console.error('Failed to save capture:', captureError)
    }
  }

  // Insert signals
  const signalRows = signals.map((s: {
    type: string
    description: string
    confidence: number
    category: string
    suggestedAction: string
  }) => ({
    user_id: user.id,
    organization_id: orgId,
    account_id,
    account_name,
    signal_type: s.type,
    description: s.description,
    confidence: Math.min(1, Math.max(0, s.confidence ?? 0.8)),
    sub_category: s.category || '',
    suggested_action: s.suggestedAction || '',
    transcript: transcript || null,
    capture_id: captureId,
  }))

  const { data: savedSignals, error: signalError } = await supabase
    .from('signals')
    .insert(signalRows)
    .select()

  if (signalError) {
    console.error('Failed to save signals:', signalError)
    return NextResponse.json({ error: 'Failed to save signals' }, { status: 500 })
  }

  // Insert tasks
  let savedTasks: unknown[] = []
  if (tasks?.length) {
    const now = new Date()
    const taskRows = tasks.map((t: { task: string; priority: string }) => {
      const daysToAdd = t.priority === 'high' ? 2 : t.priority === 'medium' ? 7 : 14
      const dueDate = new Date(now)
      dueDate.setDate(dueDate.getDate() + daysToAdd)

      return {
        user_id: user.id,
        organization_id: orgId,
        account_id,
        account_name,
        task: t.task,
        priority: t.priority,
        due_date: dueDate.toISOString().split('T')[0],
        completed: false,
        capture_id: captureId,
      }
    })

    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .insert(taskRows)
      .select()

    if (taskError) {
      console.error('Failed to save tasks:', taskError)
      // Signals were saved successfully, so don't fail the whole request
    } else {
      savedTasks = taskData || []
    }
  }

  revalidatePath('/capture')
  revalidatePath('/dashboard')
  revalidatePath('/accounts')
  revalidatePath(`/accounts/${account_id}`)

  return NextResponse.json({ signals: savedSignals, tasks: savedTasks })
}
