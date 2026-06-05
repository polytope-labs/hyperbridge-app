import { APP_URL } from "@/config/constants"
import { copyToClipboard } from "@/lib/utils/clipboard"
import { toast } from "@/lib/utils/toast"

export const getReferralLink = (address: string): string => {
  return `${APP_URL}/?ref=${address}`
}

export const handleCopyReferralLink = async (address: string) => {
  const referralLink = getReferralLink(address)

  await copyToClipboard(referralLink)
  toast.success("Referral link copied to clipboard!")
}
