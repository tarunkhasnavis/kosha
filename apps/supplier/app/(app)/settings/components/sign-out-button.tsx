'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@kosha/ui'
import { LogOut } from 'lucide-react'
import { createClient } from '@kosha/supabase/client'

export function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <Button
      variant="outline"
      className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200"
      onClick={handleSignOut}
    >
      <LogOut className="h-4 w-4 mr-2" />
      Sign Out
    </Button>
  )
}
