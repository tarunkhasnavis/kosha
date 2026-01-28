"use client"

import { useState } from "react"
import { FileText, FileSpreadsheet, Image, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { OrderAttachmentData } from "@/lib/orders/actions"
import { getAttachmentDownloadUrlAction } from "@/lib/orders/actions"

interface AttachmentViewerProps {
  attachments: OrderAttachmentData[]
  /** When true, hides the header and border-top (used in tabbed context) */
  compact?: boolean
}

/**
 * Get icon for attachment based on mime type
 */
function getAttachmentIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return Image
  }
  if (mimeType === 'application/pdf') {
    return FileText
  }
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return FileSpreadsheet
  }
  return FileText
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Attachment content viewer - displays based on processed type
 */
function AttachmentContent({ attachment }: { attachment: OrderAttachmentData }) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    if (!attachment.storagePath) return

    setDownloading(true)
    try {
      const url = await getAttachmentDownloadUrlAction(attachment.storagePath)
      if (url) {
        window.open(url, '_blank')
      }
    } catch (error) {
      console.error('Failed to get download URL:', error)
    } finally {
      setDownloading(false)
    }
  }

  // Image attachment
  if (attachment.processedType === 'image_base64' && attachment.processedContent) {
    const images = attachment.processedContent.split('|||')
    return (
      <div className="space-y-4">
        {images.map((base64, index) => (
          <img
            key={index}
            src={`data:${attachment.mimeType};base64,${base64}`}
            alt={`${attachment.filename}${images.length > 1 ? ` - Page ${index + 1}` : ''}`}
            className="max-w-full rounded-lg border border-slate-200"
          />
        ))}
      </div>
    )
  }

  // PDF text content
  if (attachment.processedType === 'pdf_text' && attachment.processedContent) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Extracted text from PDF</span>
          {attachment.storagePath && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
              className="h-7 text-xs"
            >
              {downloading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Download className="h-3 w-3 mr-1" />
              )}
              Download Original
            </Button>
          )}
        </div>
        <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans bg-white rounded-lg p-3 border border-slate-200 max-h-96 overflow-y-auto">
          {attachment.processedContent}
        </pre>
      </div>
    )
  }

  // Excel JSON content
  if (attachment.processedType === 'excel_json' && attachment.processedContent) {
    let sheets: Record<string, Record<string, unknown>[]> = {}
    try {
      sheets = JSON.parse(attachment.processedContent)
    } catch {
      // Invalid JSON
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Excel data</span>
          {attachment.storagePath && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
              className="h-7 text-xs"
            >
              {downloading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Download className="h-3 w-3 mr-1" />
              )}
              Download Original
            </Button>
          )}
        </div>
        {Object.entries(sheets).map(([sheetName, rows]) => (
          <div key={sheetName} className="space-y-2">
            <h4 className="text-xs font-medium text-slate-700">{sheetName}</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50">
                  <tr>
                    {rows[0] && Object.keys(rows[0]).map((key) => (
                      <th key={key} className="px-2 py-1.5 text-left font-medium text-slate-600 border-b border-slate-200">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      {Object.values(row).map((val, cellIdx) => (
                        <td key={cellIdx} className="px-2 py-1 text-slate-600 border-b border-slate-100">
                          {String(val ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && (
                <p className="text-xs text-slate-400 mt-2">
                  Showing first 20 of {rows.length} rows
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // No processed content - just show download button
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-400">
      <FileText className="h-12 w-12 mb-3" />
      <p className="text-sm mb-3">Preview not available</p>
      {attachment.storagePath && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Download File
        </Button>
      )}
    </div>
  )
}

/**
 * Main attachment viewer with tabs
 */
export function AttachmentViewer({ attachments, compact }: AttachmentViewerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  if (attachments.length === 0) {
    return null
  }

  const selectedAttachment = attachments[selectedIndex]

  return (
    <div className={compact ? "" : "mt-4 border-t border-slate-200 pt-4"}>
      {!compact && (
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
          Attachments ({attachments.length})
        </h4>
      )}

      {/* Attachment tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {attachments.map((att, index) => {
          const Icon = getAttachmentIcon(att.mimeType)
          const isSelected = index === selectedIndex

          return (
            <button
              key={att.id}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                isSelected
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-[150px] truncate">{att.filename}</span>
              <span className={cn(
                "text-xs",
                isSelected ? "text-slate-300" : "text-slate-400"
              )}>
                {formatFileSize(att.fileSize)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Selected attachment content */}
      <div className="bg-slate-50 rounded-lg p-4">
        <AttachmentContent attachment={selectedAttachment} />
      </div>
    </div>
  )
}
