'use client'

import { useState, useRef, useCallback } from 'react'
import { Paperclip, X, FileText, ImageIcon, FileSpreadsheet, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatInputProps {
  onSend: (message: string, file?: File) => void
  disabled?: boolean
  placeholder?: string
  skipLabel?: string
  onSkip?: () => void
  showSkip?: boolean
}

export function ChatInput({ onSend, disabled, placeholder = 'Ask anything...', skipLabel, onSkip, showSkip = true }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    if ((!message.trim() && !attachedFile) || disabled) return

    onSend(message.trim(), attachedFile || undefined)
    setMessage('')
    setAttachedFile(null)
    textareaRef.current?.focus()
  }, [message, attachedFile, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = (file: File) => {
    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10MB.')
      return
    }

    setAttachedFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return ImageIcon
    if (file.type.includes('spreadsheet') || file.type.includes('excel') || file.name.endsWith('.csv')) {
      return FileSpreadsheet
    }
    return FileText
  }

  const canSend = (message.trim() || attachedFile) && !disabled

  return (
    <div
      className={cn(
        'px-4 pt-4 pb-16 transition-colors',
        isDragOver && 'bg-gray-50'
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Attached file preview */}
      <AnimatePresence>
        {attachedFile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3"
          >
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 max-w-fit">
              {(() => {
                const Icon = getFileIcon(attachedFile)
                return <Icon className="w-4 h-4 text-gray-500" />
              })()}
              <span className="text-sm text-gray-700 truncate max-w-[200px]">
                {attachedFile.name}
              </span>
              <span className="text-xs text-gray-400">
                {(attachedFile.size / 1024).toFixed(1)} KB
              </span>
              <button
                onClick={() => setAttachedFile(null)}
                className="text-gray-400 hover:text-gray-600 ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input container - rounded pill with buttons inside */}
      <div
        className={cn(
          'relative flex items-center rounded-full border bg-gray-50 transition-all',
          isDragOver ? 'border-gray-400 bg-gray-100' : 'border-gray-200',
          'focus-within:border-gray-300 focus-within:bg-white focus-within:shadow-sm'
        )}
      >
        {/* Attachment button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className={cn(
            'flex-shrink-0 p-3 text-gray-400 hover:text-gray-600 transition-colors',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelect(file)
            e.target.value = ''
          }}
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 bg-transparent border-0 outline-none resize-none py-3 text-gray-900 placeholder:text-gray-400',
            'min-h-[24px] max-h-[120px]',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          style={{
            height: 'auto',
            overflow: 'hidden',
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = 'auto'
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'flex-shrink-0 m-1.5 p-2 rounded-full transition-all',
            canSend
              ? 'bg-[#16a34a] text-white hover:bg-[#15803d]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          )}
        >
          <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>

      {/* Skip button - below input, centered, subtle styling */}
      <AnimatePresence>
        {skipLabel && onSkip && showSkip && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex justify-center mt-3"
          >
            <button
              onClick={onSkip}
              disabled={disabled}
              className={cn(
                'text-sm text-gray-400 hover:text-gray-600 transition-colors',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {skipLabel}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag overlay hint */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gray-900/10 flex items-center justify-center rounded-lg pointer-events-none"
          >
            <div className="bg-white rounded-lg px-4 py-2 shadow-lg text-sm font-medium text-gray-700">
              Drop file here
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
