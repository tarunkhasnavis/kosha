import { buildSystemPrompt } from '../../../lib/llm/prompt'

describe('system prompt builder', () => {
  it('includes agent identity', () => {
    const prompt = buildSystemPrompt({})
    expect(prompt).toContain('Kosha')
    expect(prompt).toContain('warm')
    expect(prompt).toContain('colleague')
  })

  it('includes debrief guidance', () => {
    const prompt = buildSystemPrompt({})
    expect(prompt).toContain('Who was there')
    expect(prompt).toContain('next steps')
  })

  it('includes response style rules', () => {
    const prompt = buildSystemPrompt({})
    expect(prompt).toContain('short')
    expect(prompt).toContain('verbose')
  })

  it('injects account context when provided', () => {
    const prompt = buildSystemPrompt({
      accountContext: 'Roosters Drive In — bar in Cumming GA, owner Danny, interested in seltzer line',
    })
    expect(prompt).toContain('Roosters Drive In')
    expect(prompt).toContain('Danny')
    expect(prompt).toContain('seltzer')
  })

  it('omits account section when no context', () => {
    const prompt = buildSystemPrompt({})
    expect(prompt).not.toContain('Account context')
  })

  it('includes rep name when provided', () => {
    const prompt = buildSystemPrompt({ repName: 'Tarun' })
    expect(prompt).toContain('Tarun')
  })

  it('includes farewell detection instruction', () => {
    const prompt = buildSystemPrompt({})
    expect(prompt).toContain('goodbye')
    expect(prompt).toContain('WRAP_UP')
  })
})
