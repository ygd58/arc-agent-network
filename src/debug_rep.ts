import { createWalletClient, createPublicClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { ARC_TESTNET, CONTRACTS, REPUTATION_ABI, IDENTITY_ABI } from "./contracts/index.js"

const pub = createPublicClient({ chain: ARC_TESTNET, transport: http() })

async function main() {
  const validatorKey = process.env.VALIDATOR_KEY as `0x${string}`
  const account = privateKeyToAccount(validatorKey)
  console.log("Validator:", account.address)

  // Agent 2493 owner kontrol
  const owner = await pub.readContract({
    address: CONTRACTS.IDENTITY_REGISTRY,
    abi: IDENTITY_ABI,
    functionName: "ownerOf",
    args: [2493n],
  })
  console.log("Agent #2493 owner:", owner)
  console.log("Same?", owner.toLowerCase() === account.address.toLowerCase())

  // Reputation dene
  const wallet = createWalletClient({ account, chain: ARC_TESTNET, transport: http() })
  try {
    const hash = await wallet.writeContract({
      address: CONTRACTS.REPUTATION_REGISTRY,
      abi: REPUTATION_ABI,
      functionName: "record",
      args: [2493n, 85n, "Good work"],
    })
    console.log("Success! TX:", hash)
  } catch(e: any) {
    console.log("Error:", e.shortMessage ?? e.message)
    // Raw error data
    if (e.cause?.data) console.log("Raw error:", e.cause.data)
  }
}

main().catch(console.error)
