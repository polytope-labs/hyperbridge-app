import { copyToClipboard } from "@/lib/utils/clipboard"
import { toast } from "@/lib/utils/toast"

export const getReferralLink = (address: string): string => {
  const referralLink = `https://app.hyperbridge.network/?ref=${address}`

  return referralLink
}

export const handleCopyReferralLink = async (address: string) => {
  const referralLink = getReferralLink(address)

  await copyToClipboard(referralLink)
  toast.success("Referral link copied to clipboard!")
}
