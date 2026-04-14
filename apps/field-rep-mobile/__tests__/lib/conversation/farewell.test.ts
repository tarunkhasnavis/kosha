import { isFarewell, hasWrapUpMarker, removeWrapUpMarker } from '../../../lib/conversation/farewell'

describe('farewell detection', () => {
  it('detects goodbye', () => {
    expect(isFarewell('Alright, goodbye')).toBe(true)
  })

  it('detects see you later', () => {
    expect(isFarewell('Okay see you later')).toBe(true)
  })

  it('detects stop recording', () => {
    expect(isFarewell('Okay stop recording please')).toBe(true)
  })

  it('detects that\'s it', () => {
    expect(isFarewell("I think that's it")).toBe(true)
  })

  it('detects thats all', () => {
    expect(isFarewell('Yeah thats all')).toBe(true)
  })

  it('detects thanks kosha', () => {
    expect(isFarewell('Thanks Kosha')).toBe(true)
  })

  it('is case insensitive', () => {
    expect(isFarewell('GOODBYE')).toBe(true)
    expect(isFarewell('See You Later')).toBe(true)
  })

  it('returns false for non-farewell text', () => {
    expect(isFarewell('Just left Roosters')).toBe(false)
    expect(isFarewell('Danny wants the new seltzer line')).toBe(false)
    expect(isFarewell('What was the pricing we quoted?')).toBe(false)
  })
})

describe('wrap up marker', () => {
  it('detects WRAP_UP marker', () => {
    expect(hasWrapUpMarker('Sounds good, got it all [WRAP_UP]')).toBe(true)
  })

  it('returns false when no marker', () => {
    expect(hasWrapUpMarker('Tell me more about that')).toBe(false)
  })

  it('removes marker from text', () => {
    expect(removeWrapUpMarker('Sounds good, got it all [WRAP_UP]')).toBe('Sounds good, got it all')
  })
})
