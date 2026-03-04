"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import { Input } from "@kosha/ui"
import type { Product } from "@kosha/types"
import { cn } from "@/lib/utils"

interface ProductComboboxProps {
  value: string
  products: Product[]
  onProductSelect: (product: Product) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  searchField?: "sku" | "name"  // Which field to display as the value
}

export function ProductCombobox({
  value,
  products,
  onProductSelect,
  placeholder = "Type to search...",
  disabled = false,
  className,
  searchField = "sku",
}: ProductComboboxProps) {
  // Internal search text - can be anything while searching
  const [searchText, setSearchText] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Track if we're currently editing (focused)
  const isEditingRef = useRef(false)

  // Sync searchText with external value when not editing
  useEffect(() => {
    if (!isEditingRef.current) {
      setSearchText(value)
    }
  }, [value])

  // Filter products based on search text
  // Supports multi-word search: "berry ghia" matches "Ghia Berry Aperitif"
  const filteredProducts = useMemo(() => {
    if (!searchText.trim()) return products

    // Split search into words and filter out empty strings
    const searchWords = searchText.toLowerCase().split(/\s+/).filter(Boolean)

    return products.filter((p) => {
      const skuLower = p.sku.toLowerCase()
      const nameLower = p.name.toLowerCase()
      const combined = `${skuLower} ${nameLower}`

      // All search words must be found somewhere in SKU or name
      return searchWords.every(word => combined.includes(word))
    })
  }, [products, searchText])

  // Update dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      const dropdownHeight = 250 // Approximate max height
      const viewportHeight = window.innerHeight

      // Check if dropdown would go below viewport
      const spaceBelow = viewportHeight - rect.bottom
      const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight

      setDropdownPosition({
        top: showAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 280),
      })
    }
  }, [])

  // Handle input change - just update search text, don't commit anything
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchText(newValue)
    setHighlightedIndex(-1)
    if (newValue.trim()) {
      updateDropdownPosition()
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }

  // Handle product selection - this is the only way to change the value
  const handleSelect = (product: Product) => {
    isSelectingRef.current = true
    isEditingRef.current = false
    onProductSelect(product)
    // Update search text to show the selected value
    setSearchText(searchField === "sku" ? product.sku : product.name)
    setIsOpen(false)
    setHighlightedIndex(-1)
    // Blur the input after selection
    inputRef.current?.blur()
  }

  // Track if a selection is in progress (to prevent blur from reverting)
  const isSelectingRef = useRef(false)

  // Handle blur - revert to the committed value if no selection was made
  const handleBlur = () => {
    // If we're in the middle of selecting, don't revert
    if (isSelectingRef.current) {
      isSelectingRef.current = false
      return
    }

    isEditingRef.current = false
    // Revert search text to the actual value
    setSearchText(value)
    // Close dropdown
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  // Handle focus
  const handleFocus = () => {
    isEditingRef.current = true
    if (products.length > 0) {
      updateDropdownPosition()
      setIsOpen(true)
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredProducts.length === 0) {
      if (e.key === "ArrowDown" && products.length > 0) {
        updateDropdownPosition()
        setIsOpen(true)
        return
      }
      if (e.key === "Escape") {
        // Revert and blur
        setSearchText(value)
        inputRef.current?.blur()
        return
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) =>
          prev < filteredProducts.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
          handleSelect(filteredProducts[highlightedIndex])
        } else if (filteredProducts.length === 1) {
          // Auto-select if only one match
          handleSelect(filteredProducts[0])
        } else {
          // No valid selection - revert and blur
          setSearchText(value)
          inputRef.current?.blur()
        }
        break
      case "Escape":
        e.preventDefault()
        // Revert and blur
        setSearchText(value)
        setIsOpen(false)
        setHighlightedIndex(-1)
        inputRef.current?.blur()
        break
      case "Tab":
        // Revert on tab (handleBlur will fire anyway)
        setSearchText(value)
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
      if (dropdownRef.current?.contains(e.target as Node)) {
        return
      }
      setIsOpen(false)
      setHighlightedIndex(-1)
    }

    window.addEventListener("scroll", handleScroll, true)
    return () => window.removeEventListener("scroll", handleScroll, true)
  }, [isOpen])

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
        {filteredProducts.length > 0 ? (
          <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {filteredProducts.map((product, index) => (
              <li
                key={product.id}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleSelect(product)
                }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "px-3 py-2 cursor-pointer text-sm",
                  index === highlightedIndex
                    ? "bg-slate-100"
                    : "hover:bg-slate-50"
                )}
              >
                <div className="font-medium text-slate-700">
                  {product.sku}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {product.name} — ${product.unit_price.toFixed(2)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-3 py-4 text-sm text-slate-500 text-center">
            No matching products
          </div>
        )}
      </div>,
      document.body
    )
  ) : null

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={searchText}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
      />
      {dropdownContent}
    </div>
  )
}
