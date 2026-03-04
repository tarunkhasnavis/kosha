import { describe, it, expect } from 'vitest'
import { cn, formatDate } from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', true && 'included', false && 'excluded')).toBe(
      'base included'
    )
  })

  it('merges tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('handles undefined and null values', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end')
  })
})

describe('formatDate', () => {
  it('formats a valid date string', () => {
    // Use ISO format with explicit time to avoid timezone issues
    const result = formatDate('2024-03-15T12:00:00Z')
    expect(result).toMatch(/Mar \d{1,2}, 2024/)
  })

  it('includes time when requested', () => {
    const result = formatDate('2024-03-15T14:30:00Z', true)
    expect(result).toMatch(/Mar \d{1,2}, 2024/)
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('returns "Invalid date" for invalid input', () => {
    expect(formatDate('not-a-date')).toBe('Invalid date')
  })

  it('returns "Invalid date" for empty string', () => {
    expect(formatDate('')).toBe('Invalid date')
  })
})
