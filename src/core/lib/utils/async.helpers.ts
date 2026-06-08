export const delay = (number: number): Promise<void> =>
  new Promise((res) => setTimeout(res, number))
