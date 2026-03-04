/**
 * Motion Design Tokens for Kosha (Neutral Pro Ops)
 *
 * Principles:
 * - Fast, calm, and confident
 * - Small distances (2-10px max)
 * - Short durations (120-220ms)
 * - Prefer opacity + slight translate/scale
 * - Avoid flashy/consumer-style animations
 */

import { Variants, Transition } from 'framer-motion'

// =============================================================================
// Duration Tokens
// =============================================================================

export const durations = {
  fast: 0.12,
  base: 0.18,
  slow: 0.22,
} as const

// =============================================================================
// Easing Tokens
// =============================================================================

export const easings = {
  easeOut: [0.32, 0.72, 0, 1] as const,
  easeInOut: [0.4, 0, 0.2, 1] as const,
  // Custom "calm" easing for Neutral Pro Ops feel
  calm: [0.25, 0.1, 0.25, 1] as const,
} as const

// =============================================================================
// Spring Configurations
// =============================================================================

export const springs = {
  // Snappy spring for micro-interactions
  snappy: {
    type: 'spring' as const,
    stiffness: 380,
    damping: 30,
    mass: 0.8,
  },
  // Gentle spring for larger elements
  gentle: {
    type: 'spring' as const,
    stiffness: 260,
    damping: 25,
    mass: 1,
  },
  // Subtle spring for tabs/indicators
  subtle: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 40,
    mass: 0.6,
  },
} as const

// =============================================================================
// Transition Presets
// =============================================================================

export const transitions = {
  fast: {
    duration: durations.fast,
    ease: easings.easeOut,
  } as Transition,
  base: {
    duration: durations.base,
    ease: easings.easeOut,
  } as Transition,
  slow: {
    duration: durations.slow,
    ease: easings.easeOut,
  } as Transition,
} as const

// =============================================================================
// Reusable Variants
// =============================================================================

// Simple fade in
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitions.base,
  },
  exit: {
    opacity: 0,
    transition: transitions.fast,
  },
}

// Fade with subtle upward movement (primary page/content animation)
export const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 6,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.base,
      ease: easings.easeOut,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: durations.fast,
      ease: easings.easeOut,
    },
  },
}

// Scale in (for modals, cards)
export const scaleIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: durations.base,
      ease: easings.easeOut,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: durations.fast,
      ease: easings.easeOut,
    },
  },
}

// Soft slide from right (for panels)
export const slideInRightSoft: Variants = {
  hidden: {
    opacity: 0,
    x: 12,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: durations.slow,
      ease: easings.easeOut,
    },
  },
  exit: {
    opacity: 0,
    x: 12,
    transition: {
      duration: durations.fast,
      ease: easings.easeOut,
    },
  },
}

// =============================================================================
// List Animation Variants (for staggered children)
// =============================================================================

export const listContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
}

export const listItem: Variants = {
  hidden: {
    opacity: 0,
    y: 6,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.base,
      ease: easings.easeOut,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    transition: {
      duration: durations.fast,
      ease: easings.easeOut,
    },
  },
}

// =============================================================================
// Row/Card Hover Variants
// =============================================================================

export const rowHover: Variants = {
  rest: {
    scale: 1,
    boxShadow: '0 0 0 rgba(15, 23, 42, 0)',
  },
  hover: {
    scale: 1.005,
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
    transition: {
      duration: durations.fast,
      ease: easings.easeOut,
    },
  },
  tap: {
    scale: 0.995,
    transition: {
      duration: 0.08,
      ease: easings.easeOut,
    },
  },
}

// =============================================================================
// Button State Variants
// =============================================================================

export const buttonStates: Variants = {
  idle: {
    scale: 1,
  },
  hover: {
    scale: 1.02,
    transition: {
      duration: durations.fast,
      ease: easings.easeOut,
    },
  },
  tap: {
    scale: 0.98,
    transition: {
      duration: 0.08,
    },
  },
  loading: {
    scale: 1,
  },
}

// =============================================================================
// Modal/Dialog Variants
// =============================================================================

export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: durations.base,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: durations.fast,
    },
  },
}

export const modalContent: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.98,
    y: 8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: durations.slow,
      ease: easings.easeOut,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 4,
    transition: {
      duration: durations.fast,
      ease: easings.easeOut,
    },
  },
}

// =============================================================================
// Tab Indicator Variant
// =============================================================================

export const tabIndicator: Variants = {
  inactive: {
    opacity: 0,
  },
  active: {
    opacity: 1,
    transition: springs.subtle,
  },
}

// =============================================================================
// Skeleton Shimmer
// =============================================================================

export const skeletonShimmer: Variants = {
  initial: {
    backgroundPosition: '-200% 0',
  },
  animate: {
    backgroundPosition: '200% 0',
    transition: {
      repeat: Infinity,
      duration: 1.5,
      ease: 'linear',
    },
  },
}

// =============================================================================
// Utility: Check for reduced motion preference
// =============================================================================

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// =============================================================================
// Utility: Get motion props based on reduced motion preference
// =============================================================================

export function getMotionProps<T extends Variants>(
  variants: T,
  options?: {
    initial?: keyof T
    animate?: keyof T
    exit?: keyof T
  }
) {
  const reducedMotion = prefersReducedMotion()

  if (reducedMotion) {
    return {
      initial: false,
      animate: options?.animate ?? 'visible',
    }
  }

  return {
    initial: options?.initial ?? 'hidden',
    animate: options?.animate ?? 'visible',
    exit: options?.exit ?? 'exit',
    variants,
  }
}
