"use client"
import { format } from "date-fns"

import { cn } from '../lib/utils'
import { Button } from './button'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

interface DatePickerProps {
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DatePicker({ selected, onSelect, placeholder = "Pick a date", className, disabled }: DatePickerProps) {
  if (disabled) {
    return (
      <Button
        variant={"outline"}
        disabled
        className={cn(
          "w-full justify-start text-left font-normal bg-slate-50 text-slate-500 cursor-not-allowed",
          className
        )}
      >
        {selected ? format(selected, "PPP") : <span>{placeholder}</span>}
      </Button>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn("w-full justify-start text-left font-normal", !selected && "text-muted-foreground", className)}
        >
          {selected ? format(selected, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={selected} onSelect={onSelect} initialFocus />
      </PopoverContent>
    </Popover>
  )
}
