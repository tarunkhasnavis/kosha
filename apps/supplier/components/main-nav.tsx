'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Young_Serif } from 'next/font/google'
import { Badge } from '@kosha/ui'
import {
  Mic,
  Building2,
  MapPin,
  Map,
  Settings,
  LogOut,
} from 'lucide-react'
import { createClient } from '@kosha/supabase/client'

const youngSerif = Young_Serif({ weight: '400', subsets: ['latin'] })

const navigation = [
  { name: 'Capture', href: '/capture', icon: Mic },
  { name: 'Accounts', href: '/accounts', icon: Building2 },
  { name: 'Visits', href: '/visits', icon: MapPin },
  { name: 'Map', href: '/territory', icon: Map },
]

const navVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: 'easeOut' as const,
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

const navItemVariants = {
  hidden: { x: -10, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' as const },
  },
}

const mobileNavVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' as const },
  },
}

interface MainNavProps {
  role?: string
  orgName?: string
}

export function MainNav({ role, orgName }: MainNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Desktop sidebar */}
      <motion.nav
        className="hidden md:flex fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-[rgba(15,23,42,0.06)] flex-col"
        variants={navVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Logo + Org */}
        <motion.div className="px-6 pt-5 pb-3" variants={navItemVariants}>
          <Link href="/capture">
            <span className={`text-[22px] text-slate-900 ${youngSerif.className}`}>kosha</span>
          </Link>
          {orgName && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-slate-500 truncate">{orgName}</span>
              {role === 'admin' && (
                <Badge className="bg-slate-900 text-white text-[10px] px-1.5 py-0 h-4 font-medium">
                  Admin
                </Badge>
              )}
            </div>
          )}
        </motion.div>

        {/* Navigation Links */}
        <motion.div className="flex-1 px-3 py-4" variants={navItemVariants}>
          <div className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150',
                    isActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </motion.div>

        {/* Footer Navigation */}
        <motion.div className="mx-3 px-0 pb-3 border-t border-[rgba(15,23,42,0.06)] pt-3" variants={navItemVariants}>
          <div className="space-y-1">
            <Link
              href="/settings"
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-150',
                pathname === '/settings' || pathname?.startsWith('/settings/')
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-150 text-slate-400 hover:text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </motion.div>
      </motion.nav>

      {/* Mobile bottom tab bar */}
      <motion.nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[rgba(15,23,42,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        variants={mobileNavVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex items-center justify-around h-16">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-150 min-w-[56px]',
                  isActive
                    ? 'text-slate-900'
                    : 'text-slate-400'
                )}
              >
                <item.icon className={cn('h-5 w-5', isActive && 'text-slate-900')} />
                <span className={cn(
                  'text-[10px] font-medium',
                  isActive ? 'text-slate-900' : 'text-slate-400'
                )}>
                  {item.name}
                </span>
              </Link>
            )
          })}
        </div>
      </motion.nav>
    </>
  )
}
