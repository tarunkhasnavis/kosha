'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from '@kosha/ui'
import { Young_Serif } from 'next/font/google'
import { completeOnboarding } from './actions'

const youngSerif = Young_Serif({ weight: '400', subsets: ['latin'] })

export default function OnboardingPage() {
  const router = useRouter()
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim()) return

    setLoading(true)
    setError('')

    const result = await completeOnboarding(orgName.trim())

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push('/capture')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F7F8FA]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className={`text-3xl text-slate-900 ${youngSerif.className}`}>kosha</h1>
          <p className="text-muted-foreground mt-2">Welcome! Let&apos;s get you set up.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>What&apos;s your company name?</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g., Acme Beverage Co"
                  autoFocus
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !orgName.trim()}
              >
                {loading ? 'Setting up...' : 'Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
