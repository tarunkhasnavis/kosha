import { createClient } from '@kosha/supabase/server'
import { getUser } from '@kosha/supabase'
import { getOrganizationId } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { scoreAccount } from '@/lib/scoring/actions'

/**
 * POST /api/capture/save
 *
 * Persists insights and tasks extracted by the voice agent.
 * Accepts multiple insights and tasks from a single conversation.
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
  const { account_id, account_name, insights, tasks, transcript, summary, mode, notes } = body

  // Handle note mode — save notes to account_notes table
  if (mode === 'note') {
    if (!account_id || !notes?.length) {
      return NextResponse.json({ error: 'Missing account_id or notes' }, { status: 400 })
    }
    const supabase = await createClient()
    const noteRows = (notes as string[]).map((content: string) => ({
      organization_id: orgId,
      account_id,
      user_id: user.id,
      content,
    }))
    const { error: noteError } = await supabase
      .from('account_notes')
      .insert(noteRows)
    if (noteError) {
      console.error('Failed to save notes:', noteError)
      return NextResponse.json({ error: 'Failed to save notes' }, { status: 500 })
    }
    // Recompute account score after new notes
    scoreAccount(account_id).catch((err) =>
      console.error('Background score computation failed:', err)
    )

    revalidatePath('/capture')
    revalidatePath('/territory')
    return NextResponse.json({ saved: true })
  }

  // Handle prep and discovery — save transcript for conversation history only
  if (mode === 'prep' || mode === 'discovery') {
    if (transcript) {
      const supabase = await createClient()
      const { error: captureError } = await supabase
        .from('captures')
        .insert({
          id: crypto.randomUUID(),
          user_id: user.id,
          organization_id: orgId,
          account_id: account_id || null,
          account_name: account_name || (mode === 'discovery' ? 'Discovery' : 'Prep'),
          transcript,
          summary: null,
        })
      if (captureError) {
        console.error(`Failed to save ${mode} transcript:`, captureError)
      }
    }
    revalidatePath('/capture')
    return NextResponse.json({ saved: true })
  }

  // Debrief mode — insights and tasks are optional
  if (!account_id || !account_name) {
    return NextResponse.json({ error: 'Missing account_id or account_name' }, { status: 400 })
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
        summary: summary || null,
      })

    if (captureError) {
      console.error('Failed to save capture:', captureError)
    }
  }

  // Insert insights (if any)
  if (!insights?.length) {
    revalidatePath('/capture')
    revalidatePath('/territory')
    scoreAccount(account_id).catch((err) =>
      console.error('Background score computation failed:', err)
    )
    return NextResponse.json({ insights: [], tasks: [] })
  }

  const insightRows = insights.map((s: {
    type: string
    description: string
    category: string
    suggestedAction: string
  }) => ({
    user_id: user.id,
    organization_id: orgId,
    account_id,
    account_name,
    insight_type: s.type,
    description: s.description,
    sub_category: s.category || '',
    suggested_action: s.suggestedAction || '',
    transcript: transcript || null,
    capture_id: captureId,
  }))

  const { data: savedInsights, error: insightError } = await supabase
    .from('insights')
    .insert(insightRows)
    .select()

  if (insightError) {
    console.error('Failed to save insights:', insightError)
    return NextResponse.json({ error: 'Failed to save insights' }, { status: 500 })
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
      // Insights were saved successfully, so don't fail the whole request
    } else {
      savedTasks = taskData || []
    }
  }

  // Recompute account score after new insights/tasks
  scoreAccount(account_id).catch((err) =>
    console.error('Background score computation failed:', err)
  )

  revalidatePath('/capture')
  revalidatePath('/territory')

  return NextResponse.json({ insights: savedInsights, tasks: savedTasks })
}
