'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { fadeUp, prefersReducedMotion } from '@/lib/motion'

export default function AppTemplate({ children }: { children: ReactNode }) {
  // Respect user's motion preferences
  const reduceMotion = prefersReducedMotion()

  if (reduceMotion) {
    return <>{children}</>
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="min-h-full"
    >
      {children}
    </motion.div>
  )
}
