import { useCallback, useState } from "react"
import { toast } from "@/lib/utils/toast"

export function createTableSorter<T>() {
  const compareValues = (a: unknown, b: unknown): number => {
    if (a == null || b == null) return 0

    const typeA = typeof a
    const typeB = typeof b

    if (typeA === typeB) {
      switch (typeA) {
        case "number":
          return (a as number) - (b as number)
        case "string":
          return (a as string).localeCompare(b as string)
        case "boolean":
          return a === b ? 0 : a ? 1 : -1
        case "object":
          if (a instanceof Date && b instanceof Date)
            return a.getTime() - b.getTime()
          return JSON.stringify(a).localeCompare(JSON.stringify(b))
      }
    }

    return String(a).localeCompare(String(b))
  }

  return function sortData(
    data: readonly T[],
    field: keyof T | null,
    direction: "asc" | "desc" | null,
  ): T[] {
    if (!field || !direction) return [...data]

    const sorted = [...data].sort((a, b) => {
      const comparison = compareValues(a[field], b[field])
      return direction === "asc" ? comparison : -comparison
    })

    return sorted
  }
}

export async function handleCopyToClipboard(
  text: string,
  successMessage?: string,
) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(successMessage || "Copied to clipboard")
  } catch {
    toast.error("Failed to copy to clipboard")
  }
}

export function useTableSort<T>(initialField?: keyof T) {
  const [sortState, setSortState] = useState<{
    field: keyof T | null
    direction: "asc" | "desc" | null
  }>({
    field: initialField ?? null,
    direction: null,
  })

  const handleSort = useCallback((field: keyof T) => {
    setSortState((prevState) => {
      if (prevState.field === field) {
        let newDirection: "asc" | "desc" | null
        if (prevState.direction === "asc") newDirection = "desc"
        else if (prevState.direction === "desc") newDirection = null
        else newDirection = "asc"

        return {
          field: newDirection === null ? null : field,
          direction: newDirection,
        }
      } else {
        return {
          field,
          direction: "asc",
        }
      }
    })
  }, [])

  return {
    sortField: sortState.field,
    sortDirection: sortState.direction,
    handleSort,
  }
}

export const tableFormatters = {
  address: (address: string, length: number = 6): string =>
    address.length > length * 2 + 3
      ? `${address.slice(0, length)}...${address.slice(-length)}`
      : address,

  number: (value: number): string => value.toLocaleString(),

  date: (date: Date, options: Intl.DateTimeFormatOptions = {}): string => {
    const defaultOptions: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
    return date.toLocaleDateString("en-US", { ...defaultOptions, ...options })
  },

  status: (status: string): string =>
    status.charAt(0).toUpperCase() + status.slice(1),
}
