'use client'

import { cn } from '@/lib/utils'
import { ChatMessage as ChatMessageType, OnboardingAction } from '@/lib/onboarding/types'
import { User, Paperclip } from 'lucide-react'
import { Button } from '@kosha/ui'
import { ProductPreviewCard } from './ProductPreviewCard'
import { OrderExtractionCard } from './OrderExtractionCard'
import { motion } from 'framer-motion'

interface ChatMessageProps {
  message: ChatMessageType
  onActionClick?: (action: OnboardingAction) => void
}

export function ChatMessage({
  message,
  onActionClick,
}: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar - hidden for continuation messages (spacer maintains alignment) */}
      {message.hideAvatar ? (
        <div className="w-8 h-8 flex-shrink-0" />
      ) : isUser ? (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-[hsl(230,60%,85%)]">
          <User className="w-4 h-4 text-[hsl(230,51%,36%)]" />
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-[hsl(145,44%,93%)]">
          <span className="text-sm font-semibold text-[hsl(142,64%,24%)] tracking-tight">K</span>
        </div>
      )}

      {/* Message content */}
      <div
        className={cn(
          'max-w-[80%] space-y-2',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {/* Text bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5',
            isUser
              ? 'bg-[hsl(230,100%,95%)] text-[hsl(230,51%,36%)] rounded-tr-sm'
              : 'bg-white border border-slate-200 text-slate-900 rounded-tl-sm'
          )}
        >
          <p className="text-sm whitespace-pre-wrap">
            {message.content}
          </p>

          {/* Attachment indicator */}
          {message.attachment && (
            <div
              className={cn(
                'flex items-center gap-1.5 mt-2 pt-2 border-t text-xs',
                isUser ? 'border-[hsl(230,60%,85%)] text-[hsl(230,51%,45%)]' : 'border-slate-100 text-slate-500'
              )}
            >
              <Paperclip className="w-3 h-3" />
              <span className="truncate max-w-[200px]">{message.attachment.name}</span>
            </div>
          )}
        </div>

        {/* Rich content (products, order extraction) */}
        {message.richContent && (
          <div className="w-full">
            {message.richContent.type === 'product_preview' && (
              <ProductPreviewCard
                products={message.richContent.data as Parameters<typeof ProductPreviewCard>[0]['products']}
              />
            )}
            {message.richContent.type === 'order_extraction' && (
              <OrderExtractionCard
                order={message.richContent.data as Parameters<typeof OrderExtractionCard>[0]['order']}
              />
            )}
          </div>
        )}

        {/* Action buttons (skip actions are shown in ChatInput, so filter them out here) */}
        {message.actions && message.actions.filter(a => !a.id.startsWith('skip_')).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap gap-2 mt-2"
          >
            {message.actions.filter(a => !a.id.startsWith('skip_')).map((action) => {
              // Primary confirmation actions get a distinct green style
              const isPrimaryAction = action.id === 'confirm_products_import'

              return (
                <Button
                  key={action.id}
                  variant={isPrimaryAction ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onActionClick?.(action)}
                  className={cn(
                    'text-sm',
                    isPrimaryAction && 'bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,30%)] text-white'
                  )}
                >
                  {action.label}
                </Button>
              )
            })}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
