import { useState } from "react"

// Hook to copy string data to clipboard
// Uses a local hook to expose if action was successful or not
export default function useClipboard(text?: string) {
  const [isCopied, setIsCopied] = useState(false)

  async function copyToClipboard(text: string) {
    if ("clipboard" in navigator) {
      return await navigator.clipboard.writeText(text)
    }

    return Promise.resolve(
      new Error(
        "Failed to copy to clipboard. Browser does not support clipboard",
      ),
    )
  }

  function handleCopyToClipboard(text_: string) {
    const _text = text ?? text_

    if (!_text) {
      return
    }

    return copyToClipboard(_text)
      .then(() => {
        setIsCopied(true)
        setTimeout(() => {
          setIsCopied(false)
        }, 1500)
      })
      .catch((error) => {
        let errorMessage = "Failed to copy to clipboard"
        if (error instanceof Error) {
          errorMessage = error.message
        }
        throw new Error(errorMessage)
      })
  }

  return { isCopied, handleCopyToClipboard, copyToClipboard }
}
