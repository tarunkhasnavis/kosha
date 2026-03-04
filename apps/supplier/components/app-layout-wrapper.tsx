'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface AppLayoutWrapperProps {
  children: ReactNode
}

export function AppLayoutWrapper({ children }: AppLayoutWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="min-h-screen"
    >
      {children}
    </motion.div>
  )
}
