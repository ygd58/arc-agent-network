import { createPublicClient, createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { ARC_TESTNET } from "../contracts/index.js"

export function newClient(privateKey: string) {
  const pk = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
  const account = privateKeyToAccount(pk as `0x${string}`)
  const wallet = createWalletClient({ account, chain: ARC_TESTNET, transport: http() })
  const pub = createPublicClient({ chain: ARC_TESTNET, transport: http() })
  return { account, wallet, pub }
}

export const publicClient = createPublicClient({ chain: ARC_TESTNET, transport: http() })

export function parseUSDC(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".")
  return BigInt(whole) * 10n ** 6n + BigInt(frac.slice(0, 6).padEnd(6, "0"))
}

export function formatUSDC(units: bigint): string {
  const whole = units / 10n ** 6n
  const frac = (units % 10n ** 6n).toString().padStart(6, "0")
  return `${whole}.${frac}`
}

export function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
