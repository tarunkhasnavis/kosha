"use client"

import { useState, useRef } from "react"
import { usePathname } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, X, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReportIssueModalProps {
  isOpen: boolean
  onClose: () => void
  activeOrderId?: string | null
  orderStatus?: string | null
  userId?: string | null
  userEmail?: string | null
  orgId?: string | null
  orgName?: string | null
}

export function ReportIssueModal({
  isOpen,
  onClose,
  activeOrderId,
  orderStatus,
  userId,
  userEmail,
  orgId,
  orgName,
}: ReportIssueModalProps) {
  const pathname = usePathname()
  const [description, setDescription] = useState("")
  const [isBlocking, setIsBlocking] = useState(false)
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.type === "image/jpeg" || file.type === "image/png")) {
      setScreenshot(file)
    }
  }

  const handleRemoveScreenshot = () => {
    setScreenshot(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async () => {
    if (!description.trim()) return

    setIsSubmitting(true)

    try {
      // Convert screenshot to base64 if present
      let screenshotBase64: string | null = null
      let screenshotFilename: string | null = null

      if (screenshot) {
        try {
          const buffer = await screenshot.arrayBuffer()
          screenshotBase64 = Buffer.from(buffer).toString("base64")
          screenshotFilename = screenshot.name
        } catch {
          console.error("Failed to read screenshot file")
        }
      }

      // Submit the issue report
      const res = await fetch("/api/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          isBlocking,
          screenshotBase64,
          screenshotFilename,
          context: {
            path: pathname,
            activeOrderId,
            orderStatus,
            orgId,
            orgName,
            userId,
            userEmail,
            timestamp: new Date().toISOString(),
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          },
        }),
      })

      if (res.ok) {
        setIsSuccess(true)
        setTimeout(() => {
          handleClose()
        }, 1500)
      } else {
        console.error("Failed to submit issue report")
      }
    } catch (error) {
      console.error("Error submitting issue:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setDescription("")
    setIsBlocking(false)
    setScreenshot(null)
    setIsSuccess(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Report an issue</DialogTitle>
          <DialogDescription className="text-slate-500">
            Help us improve by describing what went wrong.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle className="h-12 w-12 text-emerald-500" />
            <p className="text-sm text-slate-600 font-medium">Thanks for your feedback!</p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="issue-description" className="text-sm text-slate-600">
                What went wrong?
              </Label>
              <Textarea
                id="issue-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue you encountered..."
                rows={4}
                className="resize-none bg-white border-slate-200 focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
              />
            </div>

            {/* Blocking checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="is-blocking"
                checked={isBlocking}
                onCheckedChange={(checked) => setIsBlocking(checked === true)}
              />
              <Label
                htmlFor="is-blocking"
                className="text-sm text-slate-600 cursor-pointer"
              >
                This blocked my work
              </Label>
            </div>

            {/* Screenshot upload */}
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">
                Screenshot (optional)
              </Label>
              {screenshot ? (
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex-1 text-sm text-slate-600 truncate">
                    {screenshot.name}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveScreenshot}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-3 px-4",
                    "border border-dashed border-slate-200 rounded-lg",
                    "text-sm text-slate-500 hover:text-slate-600 hover:border-slate-300",
                    "transition-colors cursor-pointer"
                  )}
                >
                  <Upload className="h-4 w-4" />
                  <span>Click to upload JPG or PNG</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Submit button */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSubmit}
                disabled={!description.trim() || isSubmitting}
                className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
