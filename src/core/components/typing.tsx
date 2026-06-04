import type React from "react"
import { useEffect, useReducer } from "react"

const delay = (number: number): Promise<void> =>
  new Promise((res) => setTimeout(res, number))

const next = (index: number, entries: string[]): number => {
  if (index < entries.length - 1) {
    return index + 1
  }
  return 0
}

interface TypeProps extends React.ComponentProps<"span"> {
  values: string[]
  speed?: number
}

type TypeState = {
  index: number
  value: string
  current: string
}

function getNextTypeState(state: TypeState, values: string[]): TypeState {
  const { current, index, value } = state

  if (current === "" && value === "") {
    const nextIndex = next(index, values)
    return {
      index: nextIndex,
      value,
      current: values[nextIndex],
    }
  }

  if (current === "") {
    return {
      ...state,
      value: value.substring(0, value.length - 1),
    }
  }

  return {
    ...state,
    current: current.substring(1),
    value: value + current[0],
  }
}

export const Type: React.FC<TypeProps> = ({ values, ...props }) => {
  const [state, dispatch] = useReducer(
    (currentState: TypeState) => getNextTypeState(currentState, values),
    values,
    (initialValues): TypeState => ({
      index: 0,
      value: "",
      current: initialValues[0] ?? "",
    }),
  )

  useEffect(() => {
    const intId = setInterval(() => {
      if (state.current === "") {
        if (state.value === values[state.index]) {
          delay(500).then(dispatch)
          return
        }

        dispatch()
        return clearInterval(intId)
      }

      dispatch()
    }, props.speed || 200)

    return () => clearInterval(intId)
  })

  return <span {...props}>{state.value}</span>
}
