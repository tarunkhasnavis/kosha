'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Button, Alert, AlertDescription } from '@kosha/ui'
import { Loader2, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { importProducts } from '@/lib/products/actions'
import type { ProductCSVRow } from '@kosha/types'

interface CSVImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: (created: number, updated: number) => void
}

type ImportStatus = 'idle' | 'parsing' | 'importing' | 'complete' | 'error'

export function CSVImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: CSVImportModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedRows, setParsedRows] = useState<ProductCSVRow[]>([])
  const [importResult, setImportResult] = useState<{
    created: number
    updated: number
    errors: string[]
  } | null>(null)

  const resetState = () => {
    setStatus('idle')
    setFileName(null)
    setParsedRows([])
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const parseCSV = (text: string): ProductCSVRow[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    // Parse header to find column indices
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))

    // Support various column name formats
    const skuIndex = header.findIndex(h =>
      h === 'sku' || h === 'item no' || h === 'item no.' || h === 'item_no' || h === 'item number' || h === 'item'
    )
    const nameIndex = header.findIndex(h =>
      h === 'name' || h === 'description' || h === 'product' || h === 'product name'
    )
    const priceIndex = header.findIndex(h =>
      h === 'unit_price' || h === 'unit price' || h === 'price' || h === 'unit'
    )

    if (skuIndex === -1 || nameIndex === -1 || priceIndex === -1) {
      throw new Error('CSV must have columns: SKU (or Item No), Name (or Description), and Unit Price (or Price)')
    }

    const rows: ProductCSVRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Simple CSV parsing (handles quoted values with commas)
      const values: string[] = []
      let current = ''
      let inQuotes = false
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      values.push(current.trim())

      const sku = values[skuIndex]?.replace(/['"]/g, '').trim()
      const name = values[nameIndex]?.replace(/['"]/g, '').trim()
      const priceStr = values[priceIndex]?.replace(/['"$,]/g, '').trim()

      if (sku && name && priceStr) {
        rows.push({ sku, name, unit_price: priceStr })
      }
    }

    return rows
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setStatus('parsing')

    try {
      const text = await file.text()
      const rows = parseCSV(text)

      if (rows.length === 0) {
        throw new Error('No valid product rows found in CSV')
      }

      setParsedRows(rows)
      setStatus('idle')
    } catch (error) {
      setStatus('error')
      toast({
        title: 'Parse Error',
        description: error instanceof Error ? error.message : 'Failed to parse CSV file',
        variant: 'destructive',
      })
    }
  }

  const handleImport = async () => {
    if (parsedRows.length === 0) return

    setStatus('importing')

    const result = await importProducts(parsedRows)

    if (result.error) {
      setStatus('error')
      toast({
        title: 'Import Error',
        description: result.error,
        variant: 'destructive',
      })
      return
    }

    setImportResult(result)
    setStatus('complete')

    if (result.created > 0 || result.updated > 0) {
      onImportComplete(result.created, result.updated)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Products from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: SKU, Name, and Unit Price
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* File Upload */}
          {status !== 'complete' && (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              {fileName ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">{fileName}</span>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to select a CSV file or drag and drop
                  </p>
                </>
              )}
            </div>
          )}

          {/* Parsed Preview */}
          {parsedRows.length > 0 && status !== 'complete' && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                Found <span className="font-semibold">{parsedRows.length}</span> product{parsedRows.length !== 1 ? 's' : ''} to import.
                Existing SKUs will be updated.
              </AlertDescription>
            </Alert>
          )}

          {/* Import Result */}
          {status === 'complete' && importResult && (
            <div className="space-y-3">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Import complete! Created {importResult.created} new product{importResult.created !== 1 ? 's' : ''},
                  updated {importResult.updated} existing.
                </AlertDescription>
              </Alert>

              {importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">{importResult.errors.length} error{importResult.errors.length !== 1 ? 's' : ''}:</div>
                    <ul className="text-xs space-y-1 max-h-24 overflow-y-auto">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li>...and {importResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Example Format */}
          {status === 'idle' && parsedRows.length === 0 && (
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Example CSV format:</p>
              <pre className="bg-gray-100 p-2 rounded text-[10px] overflow-x-auto">
{`SKU,Name,Unit Price
VL5002,Ghia Aperitif 6/500ml,$147.00
VL5003,Ghia Berry Aperitif 6/500ml,$147.00`}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter>
          {status === 'complete' ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={parsedRows.length === 0 || status === 'parsing' || status === 'importing'}
              >
                {status === 'parsing' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : status === 'importing' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {parsedRows.length} Product{parsedRows.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
