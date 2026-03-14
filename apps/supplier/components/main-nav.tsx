'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Home,
  MapPin,
  CheckSquare,
  Users,
} from 'lucide-react'

const navigation = [
  { name: 'Home', href: '/capture', icon: Home },
  { name: 'Map', href: '/territory', icon: MapPin },
  { name: 'Accounts', href: '/accounts', icon: Users },
  { name: 'Tasks', href: '/next-steps', icon: CheckSquare },
] as const

export function MainNav() {
  const pathname = usePathname()

  return (
    <motion.nav
      className="fixed bottom-0 inset-x-0 z-40 bg-stone-50 border-t border-stone-200/50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'p-2 rounded-full transition-colors duration-200',
                isActive
                  ? 'text-stone-800'
                  : 'text-stone-400 hover:text-stone-600'
              )}
            >
              <item.icon
                className="h-5 w-5"
                strokeWidth={isActive ? 2.4 : 1.8}
              />
            </Link>
          )
        })}
      </div>
    </motion.nav>
  )
}
