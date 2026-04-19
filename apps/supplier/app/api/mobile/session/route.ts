import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getOpenAI } from '@/lib/openai'

/**
 * POST /api/mobile/session
 *
 * Mobile app endpoint for saving completed voice sessions.
 * Accepts Bearer token auth (Supabase access_token from mobile app).
 *
 * Flow:
 * 1. Validates auth via Bearer token
 * 2. Saves raw transcript to captures table
 * 3. Extracts accounts + tasks from transcript (async)
 * 4. Saves extracted data
 * 5. Updates account summaries
 *
 * The mobile app calls this once when a conversation ends.
 * Everything else happens server-side.
 */

const EXTRACTION_PROMPT = `You extract structured data from a sales rep's voice note transcript.

Given a transcript, extract:

1. ACCOUNTS — business/venue names mentioned.
   - name: the business name exactly as mentioned

2. TASKS — follow-up action items the rep needs to do.
   - task: clear description of what needs to happen
   - due_date: if mentioned (resolve relative dates to ISO format), null otherwise
   - account_name: which account this relates to

3. SUMMARY — bullet-point summary of key takeaways. Each bullet is one fact or observation. Keep it scannable — a rep should absorb it in 5 seconds.

Rules:
- Only extract clearly actionable tasks ("send pricing by Friday"), not vague intentions ("maybe follow up")
- Account names should match exactly as the rep said them
- Summary should be bullet points, not prose. 3-6 bullets max.
- If no accounts or tasks mentioned, return empty arrays

Respond with JSON:
{
  "summary": "- Met with Danny, bar manager\\n- Wants citrus seltzer line, 5 cases\\n- Delivery needed by Friday\\n- Competitor across street switched distributors",
  "accounts": [{ "name": "Roosters" }],
  "tasks": [{ "task": "Send pricing sheet to Danny", "due_date": "2026-04-18", "account_name": "Roosters" }]
}`

// Authenticate via Bearer token (mobile app sends Supabase access_token)
async function authenticateRequest(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)

  // Create a Supabase client with the user's token
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null

  // Get org ID from supplier_profiles
  const { data: profile } = await supabase
    .from('supplier_profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) return null

  return {
    user,
    orgId: profile.organization_id,
    supabase,
  }
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request)
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { user, orgId, supabase } = auth

  const body = await request.json()
  const { transcript, duration_seconds, mode } = body

  if (!transcript) {
    return NextResponse.json({ error: 'Transcript is required' }, { status: 400 })
  }

  try {
    // Step 1: Extract accounts + tasks from transcript
    let extracted = { summary: '', accounts: [] as any[], tasks: [] as any[] }
    try {
      const openai = getOpenAI()
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: transcript },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      })

      const content = response.choices[0]?.message?.content
      if (content) {
        extracted = JSON.parse(content)
      }
    } catch (extractError) {
      console.error('Extraction failed (will still save transcript):', extractError)
    }

    // Step 2: Resolve account IDs (match against existing or create new)
    const accountIds: string[] = []
    let primaryAccountId: string | null = null
    let primaryAccountName: string | null = null

    for (const account of extracted.accounts || []) {
      // Try to find existing account (case-insensitive)
      const { data: existing } = await supabase
        .from('accounts')
        .select('id, name')
        .ilike('name', account.name)
        .limit(1)
        .single()

      if (existing) {
        accountIds.push(existing.id)
        if (!primaryAccountId) {
          primaryAccountId = existing.id
          primaryAccountName = existing.name
        }
        // Update last_contact
        await supabase
          .from('accounts')
          .update({ last_contact: new Date().toISOString() })
          .eq('id', existing.id)
      } else if (account.is_new) {
        // Create placeholder account
        const { data: newAccount } = await supabase
          .from('accounts')
          .insert({
            name: account.name,
            user_id: user.id,
            organization_id: orgId,
            score: 0,
            score_reasons: [],
            last_contact: new Date().toISOString(),
          })
          .select('id, name')
          .single()

        if (newAccount) {
          accountIds.push(newAccount.id)
          if (!primaryAccountId) {
            primaryAccountId = newAccount.id
            primaryAccountName = newAccount.name
          }
        }
      }
    }

    // Step 3: Save capture (transcript)
    const captureId = crypto.randomUUID()
    const { error: captureError } = await supabase
      .from('captures')
      .insert({
        id: captureId,
        user_id: user.id,
        organization_id: orgId,
        account_id: primaryAccountId,
        account_name: primaryAccountName || 'Unknown',
        transcript,
        summary: extracted.summary || null,
      })

    if (captureError) {
      console.error('Failed to save capture:', captureError)
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
    }

    // Step 4: Save tasks
    if (extracted.tasks?.length > 0 && primaryAccountId) {
      const taskRows = extracted.tasks.map((t: any) => ({
        user_id: user.id,
        organization_id: orgId,
        account_id: primaryAccountId,
        account_name: t.account_name || primaryAccountName,
        task: t.task,
        priority: 'medium',
        due_date: t.due_date || null,
        completed: false,
        capture_id: captureId,
      }))

      const { error: taskError } = await supabase
        .from('tasks')
        .insert(taskRows)

      if (taskError) {
        console.error('Failed to save tasks:', taskError)
        // Don't fail the whole request — transcript is saved
      }
    }

    return NextResponse.json({
      session_id: captureId,
      summary: extracted.summary,
      accounts: extracted.accounts,
      tasks: extracted.tasks,
      status: 'processed',
    })

  } catch (error) {
    console.error('Session processing error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
