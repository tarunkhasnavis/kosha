"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { Input, Button } from "@kosha/ui"
import { Plus, Loader2, Check, AlertCircle } from "lucide-react"
import type { Customer } from "@kosha/types"
import { cn } from "@/lib/utils"

interface CustomerComboboxProps {
  /** Currently selected customer (null if none) */
  selectedCustomer: Customer | null
  /** AI-suggested customer (shown as a suggestion hint) */
  suggestedCustomer?: Customer | null
  /** Confidence score for the suggestion (0-1) */
  suggestionConfidence?: number
  /** All available customers to search */
  customers: Customer[]
  /** Called when a customer is selected */
  onCustomerSelect: (customer: Customer) => void
  /** Called when user wants to create a new customer (receives the search text as initial name) */
  onCreateNew?: (initialName: string) => void
  /** Input placeholder */
  placeholder?: string
  /** Disable the input */
  disabled?: boolean
  /** Additional class names */
  className?: string
  /** Show required indicator */
  required?: boolean
  /** Whether customer selection is loading */
  isLoading?: boolean
}

export function CustomerCombobox({
  selectedCustomer,
  suggestedCustomer,
  suggestionConfidence,
  customers,
  onCustomerSelect,
  onCreateNew,
  placeholder = "Search customers...",
  disabled = false,
  className,
  required = false,
  isLoading = false,
}: CustomerComboboxProps) {
  const [searchText, setSearchText] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isEditingRef = useRef(false)
  const isSelectingRef = useRef(false)

  // Display value when not editing
  const displayValue = selectedCustomer?.name || ""

  // Sync searchText with selected customer when not editing
  useEffect(() => {
    if (!isEditingRef.current) {
      setSearchText(displayValue)
    }
  }, [displayValue])

  // Filter customers based on search text
  const filteredCustomers = useMemo(() => {
    if (!searchText.trim()) return customers.slice(0, 50) // Limit for performance

    const searchWords = searchText.toLowerCase().split(/\s+/).filter(Boolean)

    return customers.filter((c) => {
      const nameLower = c.name.toLowerCase()
      const emailLower = (c.primary_contact_email || "").toLowerCase()
      const numberLower = (c.customer_number || "").toLowerCase()
      const combined = `${nameLower} ${emailLower} ${numberLower}`

      return searchWords.every(word => combined.includes(word))
    }).slice(0, 50)
  }, [customers, searchText])

  // Update dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      const dropdownHeight = 300
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight

      setDropdownPosition({
        top: showAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 320),
      })
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchText(newValue)
    setHighlightedIndex(-1)
    updateDropdownPosition()
    setIsOpen(true)
  }

  const handleSelect = (customer: Customer) => {
    isSelectingRef.current = true
    isEditingRef.current = false
    onCustomerSelect(customer)
    setSearchText(customer.name)
    setIsOpen(false)
    setHighlightedIndex(-1)
    inputRef.current?.blur()
  }

  const handleBlur = () => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false
      return
    }
    isEditingRef.current = false
    setSearchText(displayValue)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleFocus = () => {
    isEditingRef.current = true
    // Select all text for easy replacement
    inputRef.current?.select()
    updateDropdownPosition()
    setIsOpen(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredCustomers.length === 0) {
      if (e.key === "ArrowDown" && customers.length > 0) {
        updateDropdownPosition()
        setIsOpen(true)
        return
      }
      if (e.key === "Escape") {
        setSearchText(displayValue)
        inputRef.current?.blur()
        return
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < filteredCustomers.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredCustomers.length) {
          handleSelect(filteredCustomers[highlightedIndex])
        } else if (filteredCustomers.length === 1) {
          handleSelect(filteredCustomers[0])
        } else {
          setSearchText(displayValue)
          inputRef.current?.blur()
        }
        break
      case "Escape":
        e.preventDefault()
        setSearchText(displayValue)
        setIsOpen(false)
        setHighlightedIndex(-1)
        inputRef.current?.blur()
        break
      case "Tab":
        setSearchText(displayValue)
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement
      item?.scrollIntoView({ block: "nearest" })
    }
  }, [highlightedIndex])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(target)
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target)

      if (isOutsideContainer && isOutsideDropdown) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Close dropdown on scroll outside
  useEffect(() => {
    if (!isOpen) return

    const handleScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return
      setIsOpen(false)
      setHighlightedIndex(-1)
    }

    window.addEventListener("scroll", handleScroll, true)
    return () => window.removeEventListener("scroll", handleScroll, true)
  }, [isOpen])

  // Format confidence as percentage
  const confidencePercent = suggestionConfidence ? Math.round(suggestionConfidence * 100) : 0

  // Dropdown content
  const dropdownContent = isOpen && typeof document !== 'undefined' ? (
    createPortal(
      <div
        ref={dropdownRef}
        className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-lg pointer-events-auto"
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: dropdownPosition.width,
        }}
        onWheel={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Suggestion hint if available and no customer selected */}
        {suggestedCustomer && !selectedCustomer && (
          <div className="px-3 py-2 border-b border-slate-100 bg-blue-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-blue-600">Suggested Match</span>
                <span className="text-xs text-blue-500">({confidencePercent}%)</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSelect(suggestedCustomer)
                }}
              >
                <Check className="h-3 w-3 mr-1" />
                Accept
              </Button>
            </div>
            <div className="mt-1">
              <span className="text-sm font-medium text-slate-700">{suggestedCustomer.name}</span>
              {suggestedCustomer.primary_contact_email && (
                <span className="text-xs text-slate-500 ml-2">{suggestedCustomer.primary_contact_email}</span>
              )}
            </div>
          </div>
        )}

        {filteredCustomers.length > 0 ? (
          <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {filteredCustomers.map((customer, index) => (
              <li
                key={customer.id}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSelect(customer)
                }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "px-3 py-2 cursor-pointer text-sm",
                  index === highlightedIndex
                    ? "bg-slate-100"
                    : "hover:bg-slate-50",
                  selectedCustomer?.id === customer.id && "bg-blue-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-slate-700">{customer.name}</span>
                    {customer.customer_number && (
                      <span className="text-xs text-slate-400 ml-2">#{customer.customer_number}</span>
                    )}
                  </div>
                  {selectedCustomer?.id === customer.id && (
                    <Check className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                {(customer.primary_contact_email || customer.primary_contact_name) && (
                  <div className="text-xs text-slate-500 truncate mt-0.5">
                    {customer.primary_contact_name && <span>{customer.primary_contact_name}</span>}
                    {customer.primary_contact_name && customer.primary_contact_email && " · "}
                    {customer.primary_contact_email && <span>{customer.primary_contact_email}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-3 py-4 text-sm text-slate-500 text-center">
            No matching customers
          </div>
        )}

        {/* Create new customer option */}
        {onCreateNew && (
          <div className="border-t border-slate-100 p-2">
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsOpen(false)
                onCreateNew(searchText.trim())
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create new customer{searchText.trim() ? `: "${searchText.trim()}"` : ""}
            </Button>
          </div>
        )}
      </div>,
      document.body
    )
  ) : null

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={searchText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={cn(
            "pr-8",
            required && !selectedCustomer && "border-red-300",
            selectedCustomer && "border-green-300"
          )}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
        )}
        {!isLoading && selectedCustomer && (
          <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
        )}
        {!isLoading && !selectedCustomer && required && (
          <AlertCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />
        )}
      </div>

      {/* Suggestion hint below input when not open */}
      {suggestedCustomer && !selectedCustomer && !isOpen && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <span className="text-blue-600 font-medium">Suggested:</span>
          <span className="text-slate-600">{suggestedCustomer.name}</span>
          <span className="text-slate-400">({confidencePercent}% match)</span>
          <Button
            size="sm"
            variant="link"
            className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700"
            onClick={() => handleSelect(suggestedCustomer)}
          >
            Accept
          </Button>
        </div>
      )}

      {dropdownContent}
    </div>
  )
}
