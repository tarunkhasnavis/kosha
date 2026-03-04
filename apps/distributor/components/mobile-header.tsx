'use client'

import { Menu } from 'lucide-react'
import { useSidebar } from '@/hooks/use-sidebar'
import { Young_Serif } from 'next/font/google'

const youngSerif = Young_Serif({ weight: '400', subsets: ['latin'] })

export function MobileHeader() {
  const { toggle } = useSidebar()

  return (
    <div className="md:hidden sticky top-0 z-30 flex items-center h-14 px-4 bg-white border-b border-slate-200/60">
      <button
        onClick={toggle}
        className="flex items-center justify-center w-11 h-11 -ml-2 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="Toggle navigation"
      >
        <Menu className="h-5 w-5 text-slate-700" />
      </button>
      <span className={`flex-1 text-center text-lg text-slate-900 ${youngSerif.className}`}>
        kosha
      </span>
      <div className="w-11" />
    </div>
  )
}
