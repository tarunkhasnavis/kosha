"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Download, FileText, Receipt, Loader2 } from "lucide-react"

export type DocumentType = "order_form" | "invoice"

interface DownloadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  orderNumber: string
  onDownload: (types: DocumentType[]) => Promise<void>
}

export function DownloadModal({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onDownload,
}: DownloadModalProps) {
  const [selectedTypes, setSelectedTypes] = useState<DocumentType[]>(["order_form"])
  const [isDownloading, setIsDownloading] = useState(false)

  const toggleType = (type: DocumentType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const handleDownload = async () => {
    if (selectedTypes.length === 0) return
    setIsDownloading(true)
    try {
      await onDownload(selectedTypes)
      onOpenChange(false)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Download Documents</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-slate-500 mb-4">
            Select the document type(s) to download for order {orderNumber}
          </p>
          <div className="space-y-3">
            <div
              className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedTypes.includes("order_form")
                  ? "border-slate-400 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              onClick={() => toggleType("order_form")}
            >
              <Checkbox
                id="order_form"
                checked={selectedTypes.includes("order_form")}
                onCheckedChange={() => toggleType("order_form")}
              />
              <FileText className="h-5 w-5 text-slate-500" />
              <div className="flex-1">
                <Label htmlFor="order_form" className="font-medium cursor-pointer">
                  Order Form
                </Label>
                <p className="text-xs text-slate-500">Sales order with delivery details</p>
              </div>
            </div>
            <div
              className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedTypes.includes("invoice")
                  ? "border-slate-400 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
              onClick={() => toggleType("invoice")}
            >
              <Checkbox
                id="invoice"
                checked={selectedTypes.includes("invoice")}
                onCheckedChange={() => toggleType("invoice")}
              />
              <Receipt className="h-5 w-5 text-slate-500" />
              <div className="flex-1">
                <Label htmlFor="invoice" className="font-medium cursor-pointer">
                  Invoice
                </Label>
                <p className="text-xs text-slate-500">Billing document with payment terms</p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDownloading}>
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={selectedTypes.length === 0 || isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download {selectedTypes.length > 1 ? `(${selectedTypes.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
