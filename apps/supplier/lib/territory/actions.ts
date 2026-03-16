'use server'

/**
 * Territory Server Actions
 *
 * Fetches account details (insights, tasks, visits, captures) for account panels.
 */

import { getAccountContacts } from '@/lib/accounts/queries'
import { getCapturesForAccount } from '@/lib/captures/queries'
import { getInsightsForAccount } from '@/lib/insights/queries'
import { getTasksForAccount } from '@/lib/tasks/queries'
import { getVisitsForAccount } from '@/lib/visits/queries'
import type { AccountContact, Capture, Insight, Task, Visit } from '@kosha/types'

interface AccountDetails {
  insights: Insight[]
  tasks: Task[]
  visits: Visit[]
  captures: Capture[]
  contacts: AccountContact[]
}

export async function fetchAccountDetails(
  accountId: string
): Promise<AccountDetails> {
  const [insightsResult, tasksResult, visitsResult, capturesResult, contactsResult] = await Promise.all([
    getInsightsForAccount(accountId),
    getTasksForAccount(accountId),
    getVisitsForAccount(accountId),
    getCapturesForAccount(accountId),
    getAccountContacts(accountId),
  ])

  return {
    insights: insightsResult.insights,
    tasks: tasksResult.tasks,
    visits: visitsResult.visits,
    captures: capturesResult.captures,
    contacts: contactsResult.contacts,
  }
}
