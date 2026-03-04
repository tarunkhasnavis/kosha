export { cn } from '@kosha/ui'

export function formatDate(dateString: string, includeTime = false): string {
  const date = new Date(dateString)

  if (isNaN(date.getTime())) {
    return "Invalid date"
  }

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }

  if (includeTime) {
    options.hour = "2-digit"
    options.minute = "2-digit"
  }

  return date.toLocaleDateString("en-US", options)
}
