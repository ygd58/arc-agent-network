import { publicClient } from "../utils/chain.js"
import { CONTRACTS, IDENTITY_ABI } from "../contracts/index.js"
import chalk from "chalk"

const TRANSFER_EVENT = {
  type: "event" as const,
  name: "Transfer",
  inputs: [
    { type: "address" as const, name: "from", indexed: true },
    { type: "address" as const, name: "to", indexed: true },
    { type: "uint256" as const, name: "tokenId", indexed: true },
  ],
}

const REPUTATION_ABI = [{
  name: "getReputation", type: "function", stateMutability: "view",
  inputs: [{ name: "agentId", type: "uint256" }],
  outputs: [{ name: "totalScore", type: "int256" }, { name: "count", type: "uint256" }]
}] as const

export async function showLeaderboard(topN: number = 10) {
  console.log(chalk.cyan.bold("\n╔══ ERC-8004 Agent Leaderboard ══╗"))
  console.log(chalk.gray("  Arc Testnet — Most active agents\n"))

  const latest = await publicClient.getBlockNumber()
  const fromBlock = latest > 9000n ? latest - 9000n : 0n

  const logs = await publicClient.getLogs({
    address: CONTRACTS.IDENTITY_REGISTRY,
    event: TRANSFER_EVENT,
    fromBlock,
    toBlock: latest,
  })

  const mintLogs = logs.filter(
    l => l.args.from === "0x0000000000000000000000000000000000000000"
  )

  console.log(chalk.gray("  Found " + mintLogs.length + " agents in last 9000 blocks\n"))

  type Entry = { id: bigint; owner: string; name: string; role: string; repScore: number; repCount: number }
  const agents: Entry[] = []

  for (const log of mintLogs) {
    const tokenId = log.args.tokenId as bigint
    if (tokenId === undefined || tokenId === null) continue
    try {
      const owner = await publicClient.readContract({
        address: CONTRACTS.IDENTITY_REGISTRY,
        abi: IDENTITY_ABI,
        functionName: "ownerOf",
        args: [tokenId],
      }) as string

      const uri = await publicClient.readContract({
        address: CONTRACTS.IDENTITY_REGISTRY,
        abi: IDENTITY_ABI,
        functionName: "tokenURI",
        args: [tokenId],
      }) as string

      let meta: any = {}
      try {
        const json = Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString()
        meta = JSON.parse(json)
      } catch(e: any) { console.error("Error #" + tokenId + ":", e.message) }

      // Reputation al
      let repScore = 0
      let repCount = 0
      try {
        const rep = await publicClient.readContract({
          address: CONTRACTS.REPUTATION_REGISTRY,
          abi: REPUTATION_ABI,
          functionName: "getReputation",
          args: [tokenId],
        }) as [bigint, bigint]
        repScore = Number(rep[0])
        repCount = Number(rep[1])
      } catch {}

      agents.push({ id: tokenId, owner, name: meta.name ?? "Unknown", role: meta.role ?? "unknown", repScore, repCount })
      process.stdout.write(chalk.gray("\r  Loading #" + tokenId + "..."))
    } catch(e: any) { console.error("Error #" + tokenId + ":", e.message) }
  }

  process.stdout.write("\r" + " ".repeat(40) + "\r")

  const ownerCount: Record<string, number> = {}
  for (const a of agents) ownerCount[a.owner] = (ownerCount[a.owner] ?? 0) + 1

  const sorted = [...agents].sort((a, b) => (ownerCount[b.owner] ?? 0) - (ownerCount[a.owner] ?? 0)).slice(0, topN)

  // Reputation varsa reputation'a göre sırala
  const hasRep = sorted.some(a => a.repCount > 0)
  if (hasRep) sorted.sort((a, b) => b.repScore - a.repScore)

  console.log(
    chalk.white("  Rank".padEnd(7)) +
    chalk.white("ID".padEnd(9)) +
    chalk.white("Role".padEnd(15)) +
    chalk.white("Name".padEnd(18)) +
    chalk.white("Rep Score".padEnd(12)) +
    chalk.white("Jobs".padEnd(8)) +
    chalk.white("Owner")
  )
  console.log(chalk.gray("  " + "─".repeat(88)))

  sorted.forEach((agent, idx) => {
    const rank = idx + 1
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "  " + rank + "."
    const roleColor = agent.role === "orchestrator" ? chalk.magenta
                    : agent.role === "worker" ? chalk.cyan
                    : agent.role === "evaluator" ? chalk.yellow : chalk.white
    const repStr = agent.repCount > 0
      ? chalk.green("+" + agent.repScore + " (" + agent.repCount + "x)")
      : chalk.gray("no rep")
    console.log(
      "  " + medal + " ".padEnd(4) +
      chalk.cyan(("#" + agent.id).padEnd(9)) +
      roleColor(agent.role.padEnd(15)) +
      chalk.white(agent.name.slice(0, 16).padEnd(18)) +
      repStr.padEnd(20) +
      chalk.green((ownerCount[agent.owner] + "x").padEnd(8)) +
      chalk.gray(agent.owner.slice(0, 10) + "..." + agent.owner.slice(-6))
    )
  })

  console.log(chalk.gray("\n  Total: " + agents.length + " agents | " + Object.keys(ownerCount).length + " unique owners"))
  console.log(chalk.gray("  Explorer: https://testnet.arcscan.app/token/" + CONTRACTS.IDENTITY_REGISTRY + "\n"))
}
