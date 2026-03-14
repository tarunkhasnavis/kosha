'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ScrollArea,
} from '@kosha/ui'
import { MessageSquare } from 'lucide-react'
import type { Capture } from '@kosha/types'

interface ConversationListProps {
  captures: Capture[]
  labelOverride?: string
}

function TranscriptView({ transcript }: { transcript: string }) {
  const lines = transcript.split('\n').filter(Boolean)

  return (
    <div className="space-y-3 p-1">
      {lines.map((line, i) => {
        const isRep = line.startsWith('Rep: ')
        const text = isRep ? line.slice(5) : line.replace(/^Assistant: /, '')

        return (
          <div
            key={i}
            className={`flex ${isRep ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                isRep
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-100 text-stone-800'
              }`}
            >
              {text}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ConversationList({ captures, labelOverride }: ConversationListProps) {
  const [selectedCapture, setSelectedCapture] = useState<Capture | null>(null)

  if (captures.length === 0) {
    return (
      <div className="flex flex-col items-center py-8">
        <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">
          No conversations recorded yet.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {captures.map((capture) => (
          <Card
            key={capture.id}
            className="cursor-pointer hover:bg-stone-50 transition-colors"
            onClick={() => setSelectedCapture(capture)}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-800">
                    {labelOverride || capture.account_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(capture.created_at).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={selectedCapture !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCapture(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[80vh] [&>button]:hidden">
          <DialogHeader>
            <DialogTitle>
              {selectedCapture?.account_name} &mdash;{' '}
              {selectedCapture &&
                new Date(selectedCapture.created_at).toLocaleDateString(
                  'en-US',
                  {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  }
                )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <TranscriptView
              transcript={selectedCapture?.transcript || ''}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
