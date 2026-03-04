"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Label, RadioGroup, RadioGroupItem, Textarea } from "@kosha/ui"
import { Loader2 } from "lucide-react"

const REJECTION_REASONS = [
  { value: "duplicate", label: "Duplicate order", noEmail: true },
  { value: "not_order", label: "Not an order", noEmail: true },
  { value: "customer_change", label: "Customer change", noEmail: false },
  { value: "maintenance", label: "Under maintenance", noEmail: false },
  { value: "other", label: "Other", noEmail: false },
] as const

// Reasons that should not trigger an email
export const NO_EMAIL_REASONS = ["duplicate", "not_order"] as const

type ReasonValue = (typeof REJECTION_REASONS)[number]["value"]

interface RejectOrderModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string, skipEmail: boolean) => Promise<void>
  orderNumber?: string
}

export function RejectOrderModal({
  isOpen,
  onClose,
  onConfirm,
  orderNumber,
}: RejectOrderModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReasonValue>("duplicate")
  const [otherReason, setOtherReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      let reason: string
      if (selectedReason === "other") {
        reason = otherReason.trim() || "Other"
      } else {
        const reasonOption = REJECTION_REASONS.find(r => r.value === selectedReason)
        reason = reasonOption?.label || selectedReason
      }
      const skipEmail = NO_EMAIL_REASONS.includes(selectedReason as typeof NO_EMAIL_REASONS[number])
      await onConfirm(reason, skipEmail)
      // Reset state after successful submission
      setSelectedReason("duplicate")
      setOtherReason("")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason("duplicate")
      setOtherReason("")
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Reject Order</DialogTitle>
          {orderNumber && (
            <p className="text-sm text-slate-500 mt-1">Order #{orderNumber}</p>
          )}
        </DialogHeader>

        <div className="py-2">
          <Label className="text-sm font-medium text-slate-700 mb-2 block">
            Reason for Cancellation
          </Label>

          <RadioGroup
            value={selectedReason}
            onValueChange={(value) => setSelectedReason(value as ReasonValue)}
            className="space-y-0.5"
          >
            {REJECTION_REASONS.map((reason) => (
              <div
                key={reason.value}
                className="flex items-center space-x-2.5 py-1.5 px-2 rounded-md cursor-pointer"
                onClick={() => setSelectedReason(reason.value)}
              >
                <RadioGroupItem value={reason.value} id={reason.value} />
                <Label
                  htmlFor={reason.value}
                  className="text-sm font-normal text-slate-700 cursor-pointer flex-1"
                >
                  {reason.label}
                  {reason.noEmail && (
                    <span className="text-slate-400 ml-1">(no email)</span>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {selectedReason === "other" && (
            <div className="mt-2 pl-6">
              <Textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Please specify..."
                className="resize-none h-20 text-sm"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="bg-[#B83A3A] hover:bg-[#A33232] text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Rejecting...
              </>
            ) : (
              "Reject Order"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
