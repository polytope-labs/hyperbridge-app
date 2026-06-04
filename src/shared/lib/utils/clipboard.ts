import consola from "consola"

/**
 * Copies text to the clipboard and displays a toast notification
 * @param text - The text to copy
 * @param label - The label to display in the toast notification
 */
export async function copyToClipboard(text: string, label = "Text") {
  try {
    await navigator.clipboard.writeText(text)
    // TODO: replace with toast
    consola.success(`${label} copied!`)
    //   toast.success(`${label} copied!`);
  } catch {
    //   toast.error("Failed to copy", {
    //     description: "Please try copying manually.",
    //   });
  }
}
