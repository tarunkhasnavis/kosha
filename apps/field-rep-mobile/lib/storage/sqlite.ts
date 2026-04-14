import * as SQLite from 'expo-sqlite'

type PendingSession = {
  sessionId: string
  transcriptJson: string
  sessionType: 'voice' | 'text'
  startedAt: string
  lastSavedAt: string
}

type SaveParams = {
  sessionId: string
  transcriptJson: string
  sessionType: 'voice' | 'text'
  startedAt?: string
}

/**
 * SQLite crash recovery — write-only during conversations.
 *
 * Auto-saves transcript every 10 seconds. On app open, checks for
 * orphaned sessions and sends them to post-processing.
 *
 * Never read during normal operation — only on startup.
 */
export function createCrashRecovery() {
  const db = SQLite.openDatabaseSync('kosha-recovery')

  const init = async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pending_sessions (
        session_id TEXT PRIMARY KEY,
        transcript_json TEXT NOT NULL,
        session_type TEXT NOT NULL,
        started_at TEXT NOT NULL,
        last_saved_at TEXT NOT NULL
      )
    `)
  }

  const save = async (params: SaveParams) => {
    const now = new Date().toISOString()
    await db.runAsync(
      `INSERT OR REPLACE INTO pending_sessions
        (session_id, transcript_json, session_type, started_at, last_saved_at)
        VALUES (?, ?, ?, ?, ?)`,
      [
        params.sessionId,
        params.transcriptJson,
        params.sessionType,
        params.startedAt || now,
        now,
      ]
    )
  }

  const getPending = async (): Promise<PendingSession[]> => {
    const rows = await db.getAllAsync<{
      session_id: string
      transcript_json: string
      session_type: 'voice' | 'text'
      started_at: string
      last_saved_at: string
    }>('SELECT * FROM pending_sessions')

    return rows.map((row) => ({
      sessionId: row.session_id,
      transcriptJson: row.transcript_json,
      sessionType: row.session_type,
      startedAt: row.started_at,
      lastSavedAt: row.last_saved_at,
    }))
  }

  const remove = async (sessionId: string) => {
    await db.runAsync(
      'DELETE FROM pending_sessions WHERE session_id = ?',
      [sessionId]
    )
  }

  return {
    init,
    save,
    getPending,
    remove,
  }
}

export type CrashRecovery = ReturnType<typeof createCrashRecovery>
