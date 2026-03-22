'use client'

import { useState } from 'react'
import { Textarea } from '@kosha/ui'
import { MessageCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export function FeedbackForm() {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const handleSubmit = async () => {
    if (!text.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'Feedback sent', description: 'Thank you!' })
      setText('')
    } catch {
      toast({ title: 'Error', description: 'Failed to send feedback' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-stone-500">
        <MessageCircle className="h-4 w-4" />
        <p className="text-sm">Let us know what&apos;s working, what&apos;s not, or what you&apos;d like to see.</p>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Your feedback..."
        className="min-h-[100px] resize-none"
      />
      <button
        disabled={!text.trim() || sending}
        onClick={handleSubmit}
        className="w-full py-2.5 rounded-lg bg-stone-800 text-white font-medium text-sm disabled:opacity-40 transition-opacity"
      >
        {sending ? 'Sending...' : 'Submit'}
      </button>
    </div>
  )
}
