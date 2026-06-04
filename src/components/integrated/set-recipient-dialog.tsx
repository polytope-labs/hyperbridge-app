import {
  AddressInput,
  AddressInputFocusBehaviour,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@hyperbridge/ui"
import { Ethereum, isSubstrateAddress, Polkadot } from "@hyperbridge-fe/shared"
import { isEvmAddress, matchChain } from "@hyperbridge-fe/shared/lib"
import { Either } from "effect"
import { computed, observable, runInAction } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { transferState } from "@app/stores/transfer"

export function SetRecipientDialog(props: { children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{props.children}</DialogTrigger>

      <DialogContent className="gap-0">
        <DialogHeader>
          <DialogTitle>Receiver's address</DialogTitle>
          <DialogDescription className="sr-only">
            Set the Receivers' wallet address you wish to send funds to
          </DialogDescription>
        </DialogHeader>

        <Form_ />
      </DialogContent>
    </Dialog>
  )
}

type AddressInputProps = React.ComponentProps<typeof AddressInput>

const validateAddress = computed((): AddressInputProps["validity"] => {
  const value = formState.address

  const validateSubstrate = (value?: string) => {
    if (!isSubstrateAddress(value)) {
      return Either.left("Polkadot address is invalid")
    }

    return Either.right("Polkadot Address is valid")
  }

  const validation = matchChain(transferState.destChain, {
    evm: () => {
      if (!isEvmAddress(value, { strict: true })) {
        return Either.left("Invalid EVM address")
      }

      return Either.right("Ethereum address is valid.")
    },
    relay: () => validateSubstrate(value),
    substrate: () => validateSubstrate(value),
    none: () => Either.left("Invalid destination address"),
  })

  if (Either.isLeft(validation)) {
    return { status: "error", message: validation.left }
  }

  return { status: "ok", message: validation.right }
})

const formState = observable({
  address: "",
})

const Form_ = observer(function Form_() {
  const validity = validateAddress.get()

  React.useEffect(() => {
    runInAction(() => {
      formState.address = transferState.recipient
    })

    return () => {
      console.log("Unmounting")
    }
  }, [])

  return (
    <>
      <AddressInputFocusBehaviour>
        <AddressInput
          network={matchChain(transferState.destChain, {
            evm: () => ({
              imageUrl: Ethereum.logo,
              name: "Ethereum",
            }),
            relay: () => ({
              imageUrl: Polkadot.logo,
              name: "Polkadot",
            }),
            substrate: () => ({
              imageUrl: Polkadot.logo,
              name: "Polkadot",
            }),
            none: () => ({
              imageUrl: Polkadot.logo,
              name: "--",
            }),
          })}
          validity={validity}
          value={formState.address}
          autoComplete={"off"}
          autoCapitalize={"off"}
          onChange={(event) => {
            runInAction(() => {
              formState.address = event.target.value
            })
          }}
        />
      </AddressInputFocusBehaviour>

      <DialogFooter className="mt-6">
        <DialogTrigger asChild>
          <Button
            className="flex-1"
            onClick={() => {
              setTimeout(() => {
                runInAction(() => {
                  transferState.recipient = formState.address
                })
              }, 0)
            }}
          >
            Save
          </Button>
        </DialogTrigger>
      </DialogFooter>
    </>
  )
})
