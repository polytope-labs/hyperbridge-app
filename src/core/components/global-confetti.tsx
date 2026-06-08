import Confetti from "react-confetti"
import { createPortal } from "react-dom"

interface GlobalConfettiProps {
  trigger: boolean
  onComplete?: () => void
}

export function GlobalConfetti({ trigger, onComplete }: GlobalConfettiProps) {
  if (!trigger) return null

  return createPortal(
    <Confetti
      width={window.innerWidth}
      height={window.innerHeight}
      recycle={false}
      numberOfPieces={200}
      gravity={0.3}
      colors={[
        "#ff6b6b",
        "#4ecdc4",
        "#45b7d1",
        "#96ceb4",
        "#feca57",
        "#ff9ff3",
        "#54a0ff",
        "#5f27cd",
      ]}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 50,
      }}
      onConfettiComplete={onComplete}
    />,
    document.body,
  )
}
