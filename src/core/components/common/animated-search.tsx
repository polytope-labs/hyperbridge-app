"use client"

import { XIcon } from "@hyperbridge/ui/icons"
import { Search } from "lucide-react"
import { AnimatePresence, domAnimation, LazyMotion, m } from "motion/react"
import { createContext, type ReactNode, useContext, useState } from "react"
import { cn } from "@/lib/utils"

interface AnimatedSearchContextValue {
  isOpen: boolean
  toggle: () => void
  close: () => void
}

const AnimatedSearchContext = createContext<AnimatedSearchContextValue>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
})

function useAnimatedSearch() {
  const context = useContext(AnimatedSearchContext)

  if (!context) {
    throw new Error(
      "AnimatedSearch compound components must be used within AnimatedSearch.Root",
    )
  }

  return context
}

interface RootProps {
  className?: string
  defaultOpen?: boolean
  children: ReactNode
}

const Root = ({ children, defaultOpen = false, className }: RootProps) => {
  const [isOpen, setIsOpen] = useState(() => defaultOpen)

  const toggle = () => {
    const newState = !isOpen
    setIsOpen(newState)
  }

  const close = () => {
    setIsOpen(false)
  }

  return (
    <AnimatedSearchContext.Provider value={{ isOpen: isOpen, toggle, close }}>
      <div className={cn("flex items-center", className)}>{children}</div>
    </AnimatedSearchContext.Provider>
  )
}

Root.displayName = "AnimatedSearch.Root"

interface TitleProps {
  children: ReactNode
  className?: string
}

const Title = ({ children, className }: TitleProps) => {
  const { isOpen: isActive } = useAnimatedSearch()

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence initial={false}>
        {!isActive && (
          <m.div
            key="title"
            initial={{ width: 0, opacity: 0, marginRight: 0 }}
            animate={{ width: "auto", opacity: 1, marginRight: 12 }}
            exit={{ width: 0, opacity: 0, marginRight: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{ minWidth: 0 }}
            className={cn("flex items-center gap-3 overflow-hidden", className)}
          >
            {children}
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  )
}

Title.displayName = "AnimatedSearch.Title"

interface TriggerProps {
  children?: ReactNode
  className?: string
}

const Trigger = ({ children, className }: TriggerProps) => {
  const { toggle } = useAnimatedSearch()

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "bg-brand-black-350 hover:bg-brand-black-300 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full p-2 transition-colors",
        className,
      )}
    >
      {children || <Search className="text-brand-black-100 size-4" />}
    </button>
  )
}

Trigger.displayName = "AnimatedSearch.Trigger"

interface InputProps extends React.ComponentProps<"input"> {
  onClear?: () => void
}

function Input({ ref, className, onClear, ...props }: InputProps) {
  const { isOpen: isActive, close } = useAnimatedSearch()

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence initial={false}>
        {isActive && (
          <m.div
            key="search"
            initial={{ width: 0, opacity: 0, marginLeft: 0 }}
            animate={{ width: "auto", opacity: 1, marginLeft: 12 }}
            exit={{ width: 0, opacity: 0, marginLeft: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{ minWidth: 0 }}
            className="relative overflow-hidden"
          >
            <input
              ref={ref}
              type="text"
              className={cn(
                "placeholder:text-brand-black-100 h-8 w-full border-none bg-transparent pe-6 text-2xl font-normal leading-[1.3] text-white outline-none md:w-[395px]",
                className,
              )}
              {...props}
            />

            {onClear && (
              <button
                type="button"
                className="text-brand-black-100 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer transition-colors hover:text-white"
                onClick={() => {
                  onClear?.()
                  close()
                }}
              >
                <XIcon className="size-4" />
              </button>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  )
}

Input.displayName = "AnimatedSearch.Input"

export const AnimatedSearch = {
  Root,
  Title,
  Trigger,
  Input,
} as const
