"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from "framer-motion"
import { X } from "lucide-react"

import { cn } from '../lib/utils'

// Animation configuration
const ANIMATION_DURATION = 0.3
const ANIMATION_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1] // Apple-style easing

// Animation variants for each side
const slideVariants = {
  right: {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
  },
  left: {
    initial: { x: "-100%" },
    animate: { x: 0 },
    exit: { x: "-100%" },
  },
  top: {
    initial: { y: "-100%" },
    animate: { y: 0 },
    exit: { y: "-100%" },
  },
  bottom: {
    initial: { y: "100%" },
    animate: { y: 0 },
    exit: { y: "100%" },
  },
}

const sheetVariants = cva(
  "fixed z-50 bg-background shadow-lg",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b p-6",
        bottom: "inset-x-0 bottom-0 border-t rounded-t-2xl max-h-[90vh]",
        left: "inset-y-0 left-0 h-full w-3/4 border-r p-6 sm:max-w-sm",
        right: "inset-y-0 right-0 h-full border-l",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  hideCloseButton?: boolean
}

const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

// Context to pass onOpenChange to SheetContent for swipe-to-dismiss
const SheetContext = React.createContext<{ onOpenChange?: (open: boolean) => void }>({})

// Custom Sheet that handles its own animation state
interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const Sheet = ({ open, onOpenChange, children }: SheetProps) => {
  // Track internal open state to allow exit animations to complete
  const [shouldRender, setShouldRender] = React.useState(open)

  React.useEffect(() => {
    if (open) {
      setShouldRender(true)
    }
  }, [open])

  const handleExitComplete = () => {
    if (!open) {
      setShouldRender(false)
    }
  }

  return (
    <SheetContext.Provider value={{ onOpenChange }}>
      <SheetPrimitive.Root open={shouldRender} onOpenChange={onOpenChange}>
        <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
          {open && children}
        </AnimatePresence>
      </SheetPrimitive.Root>
    </SheetContext.Provider>
  )
}

const SWIPE_THRESHOLD = 80

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, hideCloseButton, ...props }, ref) => {
  const sideKey = side || "right"
  const isBottom = sideKey === "bottom"
  const isLeft = sideKey === "left"
  const isSwipable = isBottom || isLeft
  const { onOpenChange } = React.useContext(SheetContext)
  const dragValue = useMotionValue(0)
  const overlayOpacity = useTransform(
    dragValue,
    isBottom ? [0, 300] : [0, -200],
    isBottom ? [1, 0.2] : [1, 0.2]
  )

  const handleDragEnd = React.useCallback((_: unknown, info: PanInfo) => {
    if (isBottom && (info.offset.y > SWIPE_THRESHOLD || info.velocity.y > 300)) {
      onOpenChange?.(false)
    } else if (isLeft && (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -300)) {
      onOpenChange?.(false)
    }
  }, [onOpenChange, isBottom, isLeft])

  // Drag handle grip for left sheets
  const leftGrip = isLeft && hideCloseButton ? (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-1 pr-1.5 opacity-30">
      <div className="w-0.5 h-6 rounded-full bg-stone-400" />
    </div>
  ) : null

  return (
    <SheetPortal forceMount>
      {/* Overlay with fade animation */}
      <SheetPrimitive.Overlay asChild forceMount>
        <motion.div
          className="fixed inset-0 z-50 bg-black/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: ANIMATION_DURATION, ease: "easeOut" }}
          style={isSwipable ? { opacity: overlayOpacity } : undefined}
        />
      </SheetPrimitive.Overlay>

      {/* Content with slide animation */}
      <SheetPrimitive.Content
        ref={ref}
        forceMount
        asChild
        {...props}
      >
        <motion.div
          className={cn(sheetVariants({ side }), className)}
          initial={slideVariants[sideKey].initial}
          animate={isBottom ? { y: 0 } : isLeft ? { x: 0 } : slideVariants[sideKey].animate}
          exit={slideVariants[sideKey].exit}
          transition={{
            duration: ANIMATION_DURATION,
            ease: ANIMATION_EASE,
          }}
          drag={isBottom ? "y" : isLeft ? "x" : false}
          dragConstraints={isBottom ? { top: 0, bottom: 0 } : isLeft ? { left: 0, right: 0 } : undefined}
          dragElastic={isBottom ? { top: 0, bottom: 0.6 } : isLeft ? { left: 0.6, right: 0 } : undefined}
          onDragEnd={isSwipable ? handleDragEnd : undefined}
          style={isBottom ? { y: dragValue } : isLeft ? { x: dragValue } : undefined}
        >
          {children}
          {leftGrip}
          {!hideCloseButton && (
            <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          )}
        </motion.div>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = SheetPrimitive.Content.displayName

// Keep the rest of the components
const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn("fixed inset-0 z-50 bg-black/20", className)}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
