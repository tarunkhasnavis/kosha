'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@kosha/ui'
import { ArrowLeft } from 'lucide-react'

export function BackButton() {
  const router = useRouter()

  return (
    <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
      <ArrowLeft className="h-4 w-4 mr-2" />
      Back
    </Button>
  )
}
