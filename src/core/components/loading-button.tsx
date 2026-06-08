import { Button } from "@hyperbridge/ui"
import { safeObj } from "@hyperbridge-fe/shared"
import React from "react"
import { Type } from "./typing"

type ButtonProps = React.ComponentProps<typeof Button>

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean
}

export const LoadingButton = function LoadingButton(props: LoadingButtonProps) {
  const { children, className, disabled, loading, ref, ...buttonProps } = props
  const overwrite_props = loading ? loadingProps : {}
  const [first] = React.Children.toArray(children)

  // Check if the first child is a LoadingButtonContent component
  const isRootChildLoadingButtonContent = childIs(first, LoadingButtonContent)

  return (
    <Button
      ref={ref}
      {...buttonProps}
      {...safeObj(overwrite_props)}
      disabled={disabled || loading}
      className={className}
    >
      {isRootChildLoadingButtonContent ? (
        children
      ) : (
        <LoadingButtonContent loading={loading ?? false}>
          {children}
        </LoadingButtonContent>
      )}
    </Button>
  )
}

function childIs(
  child: React.ReactNode,
  component: React.ComponentType<never>,
) {
  // @ts-expect-error Nothing
  return React.isValidElement(child) && child.type?.name === component?.name
}

export function LoadingButtonContent(props: {
  loading: boolean
  loadingText?: string
  children?: React.ReactNode
}) {
  return (
    <>
      {props.loading ? (
        <span>
          {props.loadingText ?? "Loading"}
          <Type values={[".", "..", "..."]} />
        </span>
      ) : (
        props.children
      )}
    </>
  )
}

const loadingProps = {
  variant: "secondary",
  disabled: true,
}
