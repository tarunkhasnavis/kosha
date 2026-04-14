import { createCrashRecovery } from '../../../lib/storage/sqlite'

// Mock expo-sqlite
const mockDb = {
  execAsync: jest.fn(),
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
}

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => mockDb,
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('crash recovery (SQLite)', () => {
  it('initializes the database table', async () => {
    const recovery = createCrashRecovery()
    await recovery.init()

    expect(mockDb.execAsync).toHaveBeenCalledTimes(1)
    expect(mockDb.execAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS pending_sessions')
    )
  })

  it('saves a session', async () => {
    const recovery = createCrashRecovery()
    await recovery.init()

    await recovery.save({
      sessionId: 'test-123',
      transcriptJson: '[{"speaker":"rep","text":"hello"}]',
      sessionType: 'voice',
    })

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE'),
      expect.arrayContaining(['test-123'])
    )
  })

  it('retrieves pending sessions', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        session_id: 'test-123',
        transcript_json: '[{"speaker":"rep","text":"hello"}]',
        session_type: 'voice',
        started_at: '2026-04-11T00:00:00Z',
        last_saved_at: '2026-04-11T00:00:10Z',
      },
    ])

    const recovery = createCrashRecovery()
    await recovery.init()
    const sessions = await recovery.getPending()

    expect(sessions).toHaveLength(1)
    expect(sessions[0].sessionId).toBe('test-123')
    expect(sessions[0].sessionType).toBe('voice')
  })

  it('returns empty array when no pending sessions', async () => {
    mockDb.getAllAsync.mockResolvedValue([])

    const recovery = createCrashRecovery()
    await recovery.init()
    const sessions = await recovery.getPending()

    expect(sessions).toEqual([])
  })

  it('deletes a session after successful upload', async () => {
    const recovery = createCrashRecovery()
    await recovery.init()
    await recovery.remove('test-123')

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE'),
      expect.arrayContaining(['test-123'])
    )
  })

  it('updates last_saved_at on each save', async () => {
    const recovery = createCrashRecovery()
    await recovery.init()

    await recovery.save({
      sessionId: 'test-123',
      transcriptJson: '[]',
      sessionType: 'voice',
    })

    const args = mockDb.runAsync.mock.calls[0][1]
    // last_saved_at should be a recent ISO string
    const lastSaved = args[args.length - 1]
    expect(new Date(lastSaved).getTime()).toBeGreaterThan(Date.now() - 1000)
  })
})
