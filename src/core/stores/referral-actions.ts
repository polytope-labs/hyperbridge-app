export type ReferralsData = {
  referralCode: string
  referralCount: number
  referralRewards: string
}

export async function fetchReferralsData(
  _address: string,
): Promise<ReferralsData | null> {
  return null
}
