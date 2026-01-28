'use client'

import { cn } from '@/lib/utils'
import { OnboardingStage } from '@/lib/onboarding/types'

interface ProgressBarProps {
  currentStage: OnboardingStage
  className?: string
}

const STEPS = [
  { stage: 'organization' as const, label: 'Organization' },
  { stage: 'products' as const, label: 'Products' },
]

export function ProgressBar({ currentStage, className }: ProgressBarProps) {
  const currentIndex = STEPS.findIndex(s => s.stage === currentStage)
  const effectiveIndex = currentStage === 'complete' ? STEPS.length : currentIndex

  return (
    <div className={cn('w-full max-w-lg mx-auto px-4', className)}>
      {/* Pill segments container */}
      <div className="flex items-center gap-3">
        {STEPS.map((step, index) => {
          const isCompleted = index < effectiveIndex
          const isCurrent = index === effectiveIndex

          return (
            <div key={step.stage} className="flex-1 flex flex-col items-center gap-2.5">
              {/* Pill segment */}
              <div
                className={cn(
                  'w-full h-2 rounded-full transition-all duration-300',
                  isCompleted
                    ? 'bg-[hsl(142,76%,36%)]'
                    : isCurrent
                      ? 'bg-[hsl(142,50%,55%)]'
                      : 'bg-slate-200'
                )}
              />

              {/* Label */}
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  isCompleted
                    ? 'text-[hsl(142,64%,24%)]'
                    : isCurrent
                      ? 'text-[hsl(142,50%,35%)]'
                      : 'text-slate-400'
                )}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
