import { createPublicClient, http } from "viem"
import { ARC_TESTNET, CONTRACTS } from "../contracts/index.js"
import chalk from "chalk"

const pub = createPublicClient({ chain: ARC_TESTNET, transport: http() })

const REPUTATION_ABI = [{
  name: "getReputation", type: "function", stateMutability: "view",
  inputs: [{ name: "agentId", type: "uint256" }],
  outputs: [{ name: "totalScore", type: "int256" }, { name: "count", type: "uint256" }]
}] as const

export type GateConfig = {
  minScore: number      // minimum ortalama skor (0-100)
  minReviews: number    // minimum review sayısı
  allowNewAgents: boolean // reputation'ı olmayan yeni agentlara izin ver
}

export const DEFAULT_GATE: GateConfig = {
  minScore: 70,
  minReviews: 0,
  allowNewAgents: true,
}

export type GateResult = {
  passed: boolean
  agentId: bigint
  score: number
  reviews: number
  reason: string
}

export async function checkReputationGate(
  agentId: bigint,
  gate: GateConfig = DEFAULT_GATE
): Promise<GateResult> {
  try {
    const rep = await pub.readContract({
      address: CONTRACTS.REPUTATION_REGISTRY,
      abi: REPUTATION_ABI,
      functionName: "getReputation",
      args: [agentId],
    }) as [bigint, bigint]

    const totalScore = Number(rep[0])
    const count = Number(rep[1])

    // Yeni agent — reputation yok
    if (count === 0) {
      if (gate.allowNewAgents) {
        return { passed: true, agentId, score: 0, reviews: 0, reason: "New agent — allowed" }
      }
      return { passed: false, agentId, score: 0, reviews: 0, reason: "No reputation — new agents not allowed" }
    }

    const avgScore = totalScore / count

    // Minimum review kontrolü
    if (count < gate.minReviews) {
      return {
        passed: false, agentId, score: avgScore, reviews: count,
        reason: `Insufficient reviews: ${count} < ${gate.minReviews} required`
      }
    }

    // Minimum skor kontrolü
    if (avgScore < gate.minScore) {
      return {
        passed: false, agentId, score: avgScore, reviews: count,
        reason: `Low reputation: ${avgScore.toFixed(1)} < ${gate.minScore} required`
      }
    }

    return {
      passed: true, agentId, score: avgScore, reviews: count,
      reason: `Reputation OK: ${avgScore.toFixed(1)}/100 (${count} reviews)`
    }
  } catch {
    // Kontrat hatası — yeni agent kabul et
    if (gate.allowNewAgents) {
      return { passed: true, agentId, score: 0, reviews: 0, reason: "New agent — allowed" }
    }
    return { passed: false, agentId, score: 0, reviews: 0, reason: "Could not verify reputation" }
  }
}

export function displayGateResult(result: GateResult, agentName: string) {
  if (result.passed) {
    console.log(chalk.green(`  ✓ [ReputationGate] ${agentName} passed`))
    console.log(chalk.gray(`    ${result.reason}`))
  } else {
    console.log(chalk.red(`  ✗ [ReputationGate] ${agentName} blocked`))
    console.log(chalk.red(`    ${result.reason}`))
  }
}
