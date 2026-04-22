import { createWalletClient, createPublicClient, http, keccak256, toHex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { ARC_TESTNET, CONTRACTS, IDENTITY_ABI } from "../contracts/index.js"
import chalk from "chalk"

const publicClient = createPublicClient({ chain: ARC_TESTNET, transport: http() })

const REPUTATION_ABI = [{
  name: "giveFeedback",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [
    { name: "agentId", type: "uint256" },
    { name: "value", type: "int128" },
    { name: "valueDecimals", type: "uint8" },
    { name: "tag1", type: "string" },
    { name: "tag2", type: "string" },
    { name: "endpoint", type: "string" },
    { name: "feedbackURI", type: "string" },
    { name: "feedbackHash", type: "bytes32" },
  ],
  outputs: [],
}] as const

export async function recordReputation(
  targetAgentId: bigint,
  score: number,
  comment: string,
  validatorKey?: string
): Promise<string | null> {
  const pk = validatorKey ?? process.env.VALIDATOR_KEY
  if (!pk) {
    console.log(chalk.yellow("  ⚠️  VALIDATOR_KEY bulunamadı — reputation atlanıyor"))
    return null
  }

  const account = privateKeyToAccount(pk as `0x${string}`)
  const wallet = createWalletClient({ account, chain: ARC_TESTNET, transport: http() })

  // Owner kontrolü
  try {
    const owner = await publicClient.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_ABI,
      functionName: "ownerOf",
      args: [targetAgentId],
    }) as string
    if (owner.toLowerCase() === account.address.toLowerCase()) {
      console.log(chalk.yellow("  ⚠️  Self-record yasak (ERC-8004)"))
      return null
    }
  } catch {}

  try {
    const feedbackHash = keccak256(toHex(comment)) as `0x${string}`
    const scoreValue = BigInt(score) as unknown as bigint

    const hash = await wallet.writeContract({
      address: CONTRACTS.REPUTATION_REGISTRY,
      abi: REPUTATION_ABI,
      functionName: "giveFeedback",
      args: [
        targetAgentId,    // uint256 agentId
        scoreValue,       // int128 value
        2,                // uint8 valueDecimals (score/100 = 2 decimals)
        "job_completed",  // string tag1
        "arc_testnet",    // string tag2
        "",               // string endpoint
        "",               // string feedbackURI
        feedbackHash,     // bytes32 feedbackHash
      ],
    })
    await publicClient.waitForTransactionReceipt({ hash })
    return hash
  } catch (e: any) {
    console.log(chalk.red("  ✗ Reputation hatası: " + (e.shortMessage ?? e.message)?.slice(0, 100)))
    return null
  }
}

export async function getReputation(agentId: bigint): Promise<{ score: bigint; count: bigint }> {
  try {
    const rep = await publicClient.readContract({
      address: CONTRACTS.REPUTATION_REGISTRY,
      abi: [{
        name: "getReputation",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "agentId", type: "uint256" }],
        outputs: [{ name: "totalScore", type: "int256" }, { name: "count", type: "uint256" }]
      }] as const,
      functionName: "getReputation",
      args: [agentId],
    }) as [bigint, bigint]
    return { score: rep[0], count: rep[1] }
  } catch {
    return { score: 0n, count: 0n }
  }
}
