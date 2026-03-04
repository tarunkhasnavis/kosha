import { describe, it, expect } from 'vitest'
import { isOrderStatus } from '@kosha/types'

// =============================================================================
// isOrderStatus Type Guard Tests
// =============================================================================

describe('isOrderStatus', () => {
  describe('valid statuses', () => {
    it('returns true for waiting_review', () => {
      expect(isOrderStatus('waiting_review')).toBe(true)
    })

    it('returns true for approved', () => {
      expect(isOrderStatus('approved')).toBe(true)
    })

    it('returns true for rejected', () => {
      expect(isOrderStatus('rejected')).toBe(true)
    })

    it('returns true for processing', () => {
      expect(isOrderStatus('processing')).toBe(true)
    })

    it('returns true for awaiting_clarification', () => {
      expect(isOrderStatus('awaiting_clarification')).toBe(true)
    })

    it('returns true for archived', () => {
      expect(isOrderStatus('archived')).toBe(true)
    })
  })

  describe('invalid statuses', () => {
    it('returns false for empty string', () => {
      expect(isOrderStatus('')).toBe(false)
    })

    it('returns false for unknown status', () => {
      expect(isOrderStatus('unknown')).toBe(false)
    })

    it('returns false for pending (not a valid status)', () => {
      expect(isOrderStatus('pending')).toBe(false)
    })

    it('returns false for completed (not a valid status)', () => {
      expect(isOrderStatus('completed')).toBe(false)
    })

    it('returns false for cancelled (not a valid status)', () => {
      expect(isOrderStatus('cancelled')).toBe(false)
    })
  })

  describe('case sensitivity', () => {
    it('returns false for uppercase APPROVED', () => {
      expect(isOrderStatus('APPROVED')).toBe(false)
    })

    it('returns false for mixed case Approved', () => {
      expect(isOrderStatus('Approved')).toBe(false)
    })

    it('returns false for WAITING_REVIEW', () => {
      expect(isOrderStatus('WAITING_REVIEW')).toBe(false)
    })
  })

  describe('whitespace handling', () => {
    it('returns false for status with leading space', () => {
      expect(isOrderStatus(' approved')).toBe(false)
    })

    it('returns false for status with trailing space', () => {
      expect(isOrderStatus('approved ')).toBe(false)
    })

    it('returns false for status with both leading and trailing spaces', () => {
      expect(isOrderStatus(' approved ')).toBe(false)
    })
  })
})
