import type { ArcAgent } from "../agents/base.js"
import { askClaude } from "../utils/claude.js"
import { publicClient, formatUSDC } from "../utils/chain.js"
import { CONTRACTS, USDC_ABI, REPUTATION_ABI } from "../contracts/index.js"
import type { TaskConfig } from "./types.js"
import chalk from "chalk"

export type WorkerBid = {
  worker: ArcAgent
  price: string
  estimatedTime: string
  approach: string
  reputationScore: number
}

export type AuctionResult = {
  winner: ArcAgent
  bid: WorkerBid
  reason: string
}

// Her worker için reputation score al
async function getReputationScore(agentId: bigint): Promise<number> {
  if (agentId === 0n) return 0
  try {
    const rep = await publicClient.readContract({
      address: CONTRACTS.REPUTATION_REGISTRY,
      abi: REPUTATION_ABI,
      functionName: "getReputation",
      args: [agentId],
    }) as [bigint, bigint]
    const [totalScore, count] = rep
    return count > 0n ? Number(totalScore) / Number(count) : 0
  } catch {
    return 0
  }
}

// Worker teklif oluştur
export async function workerBid(worker: ArcAgent, task: TaskConfig): Promise<WorkerBid> {
  const prompt = `You are a Worker agent on Arc blockchain testnet bidding for a job.

Task Type: ${task.type}
Task Description: ${task.description}
Maximum Budget: ${task.budget} USDC
Your Capabilities: ${worker.capabilities.join(", ")}

Submit a competitive bid. Lower price increases win chance but must be profitable.
Respond ONLY with valid JSON, no markdown:
{
  "price": "0.8",
  "estimatedTime": "2 hours",
  "approach": "brief description of how you will complete this task"
}`

  const response = await worker.think(prompt)
  let bid: any = {}
  try { bid = JSON.parse(response) }
  catch { bid = { price: task.budget, estimatedTime: "4 hours", approach: "Standard approach" } }

  const reputationScore = await getReputationScore(worker.agentId)

  return {
    worker,
    price: bid.price ?? task.budget,
    estimatedTime: bid.estimatedTime ?? "4 hours",
    approach: bid.approach ?? "Standard approach",
    reputationScore,
  }
}

// Orchestrator en iyi worker'ı seç
export async function selectBestWorker(
  orchestrator: ArcAgent,
  bids: WorkerBid[],
  task: TaskConfig
): Promise<AuctionResult> {
  const bidsJson = bids.map(b => ({
    workerName: b.worker.name,
    address: b.worker.address,
    price: b.price,
    estimatedTime: b.estimatedTime,
    approach: b.approach,
    reputationScore: b.reputationScore,
  }))

  const prompt = `You are an Orchestrator agent evaluating worker bids for a task.

Task: ${task.description}
Max Budget: ${task.budget} USDC
Required Skills: ${task.requiredSkills.join(", ")}

Worker Bids:
${JSON.stringify(bidsJson, null, 2)}

Select the best worker considering: price (lower is better), reputation (higher is better), approach quality, and estimated time.
Respond ONLY with valid JSON, no markdown:
{
  "selectedWorker": "worker name",
  "reason": "why this worker was selected"
}`

  const response = await orchestrator.think(prompt)
  let selection: any = {}
  try { selection = JSON.parse(response) }
  catch { selection = { selectedWorker: bids[0].worker.name, reason: "Lowest price" } }

  // Seçilen worker'ı bul
  const winnerBid = bids.find(b => b.worker.name === selection.selectedWorker) ?? bids[0]

  return {
    winner: winnerBid.worker,
    bid: winnerBid,
    reason: selection.reason ?? "Best overall bid",
  }
}

// Auction sürecini göster
export function displayAuction(bids: WorkerBid[], result: AuctionResult) {
  console.log(chalk.cyan("\n╔══ Worker Auction Results ══╗"))
  console.log(`  ${"Worker".padEnd(15)} ${"Price".padEnd(12)} ${"Time".padEnd(12)} ${"Reputation".padEnd(12)} Approach`)
  console.log(chalk.gray("  " + "─".repeat(80)))

  bids.forEach(bid => {
    const isWinner = bid.worker.name === result.winner.name
    const prefix = isWinner ? chalk.green("  ★ ") : chalk.gray("  ○ ")
    const name = isWinner ? chalk.green(bid.worker.name.padEnd(15)) : chalk.white(bid.worker.name.padEnd(15))
    const price = isWinner ? chalk.green((bid.price + " USDC").padEnd(12)) : chalk.white((bid.price + " USDC").padEnd(12))
    const time = chalk.gray(bid.estimatedTime.padEnd(12))
    const rep = chalk.yellow((bid.reputationScore.toFixed(1) + " pts").padEnd(12))
    const approach = chalk.gray(bid.approach.slice(0, 40))
    console.log(`${prefix}${name} ${price} ${time} ${rep} ${approach}`)
  })

  console.log(chalk.cyan(`\n  Winner: ${chalk.green.bold(result.winner.name)}`))
  console.log(chalk.gray(`  Reason: ${result.reason}`))
  console.log()
}
