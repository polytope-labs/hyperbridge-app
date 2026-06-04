import { consola } from "consola"

/**
 * Copies text to the clipboard and displays a toast notification
 * @param text - The text to copy
 * @param label - The label to display in the toast notification
 */

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    consola.error("Failed to copy text to clipboard")
  }
}
