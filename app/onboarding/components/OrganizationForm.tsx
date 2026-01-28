'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface OrganizationFormProps {
  onSubmit: (data: { name: string; phone?: string; address?: string }) => Promise<void>
  isLoading?: boolean
}

// Format phone number as user types: (555) 123-4567
function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function OrganizationForm({ onSubmit, isLoading = false }: OrganizationFormProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneNumber(e.target.value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please enter your organization name')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const loading = isLoading || isSubmitting

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Organization Name */}
      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
          Organization name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          placeholder="Acme Foods"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          autoFocus
          className="w-full px-0 py-2 text-lg bg-transparent border-0 border-b border-neutral-200 focus:border-neutral-900 focus:outline-none placeholder:text-neutral-300 text-neutral-900 transition-colors"
        />
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <label htmlFor="phone" className="block text-sm font-medium text-neutral-700">
          Phone
        </label>
        <input
          id="phone"
          type="tel"
          placeholder="(555) 123-4567"
          value={phone}
          onChange={handlePhoneChange}
          disabled={loading}
          className="w-full px-0 py-2 bg-transparent border-0 border-b border-neutral-200 focus:border-neutral-900 focus:outline-none placeholder:text-neutral-300 text-neutral-900 transition-colors"
        />
      </div>

      {/* Address */}
      <div className="space-y-2">
        <label htmlFor="address" className="block text-sm font-medium text-neutral-700">
          Address
        </label>
        <input
          id="address"
          type="text"
          placeholder="123 Main St, City, State"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={loading}
          className="w-full px-0 py-2 bg-transparent border-0 border-b border-neutral-200 focus:border-neutral-900 focus:outline-none placeholder:text-neutral-300 text-neutral-900 transition-colors"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full py-3 px-4 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating...
          </>
        ) : (
          'Continue'
        )}
      </button>
    </form>
  )
}
