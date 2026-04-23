import { createPublicClient, http } from "viem"
import { ARC_TESTNET, CONTRACTS, IDENTITY_ABI } from "../contracts/index.js"
import chalk from "chalk"

const pub = createPublicClient({ chain: ARC_TESTNET, transport: http() })

// Arc testnet gerçek JobCreated selector
const JOB_CREATED_TOPIC = "0xb0f0239bfdd96453e24733e18bfc24b70d8fadf123dd977473518dd577ee79b9" as const
const JOB_COMPLETED_TOPIC = "0x0fd54bd364fa9e67f17b091aefe930932c09fe7651cf5ad02c71a418f3341444" as const

const JOB_CREATED_EVENT = {
  type: "event" as const,
  name: "JobCreatedArc",
  inputs: [
    { type: "uint256" as const, name: "jobId", indexed: true },
    { type: "address" as const, name: "client", indexed: true },
    { type: "address" as const, name: "provider", indexed: true },
  ],
}

const REPUTATION_ABI = [{
  name: "getReputation", type: "function", stateMutability: "view",
  inputs: [{ name: "agentId", type: "uint256" }],
  outputs: [{ name: "totalScore", type: "int256" }, { name: "count", type: "uint256" }]
}] as const

const FEEDBACK_EVENT = {
  type: "event" as const,
  name: "NewFeedback",
  inputs: [
    { type: "uint256" as const, name: "agentId", indexed: true },
    { type: "address" as const, name: "clientAddress", indexed: true },
    { type: "uint256" as const, name: "feedbackIndex", indexed: true },
  ],
}

export async function showAgentStats(agentIdStr: string) {
  const agentId = BigInt(agentIdStr)
  const latest = await pub.getBlockNumber()
  const fromBlock = latest > 9000n ? latest - 9000n : 0n

  console.log(chalk.cyan.bold("\n╔══ Agent Statistics ══╗"))
  console.log(chalk.gray("  Arc Testnet — ERC-8004 + ERC-8183 Agent Stats\n"))

  // Agent kimlik bilgileri
  try {
    const owner = await pub.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_ABI,
      functionName: "ownerOf",
      args: [agentId],
    }) as string

    const uri = await pub.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_ABI,
      functionName: "tokenURI",
      args: [agentId],
    }) as string

    let meta: any = {}
    try {
      const json = Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString()
      meta = JSON.parse(json)
    } catch {}

    console.log("  " + chalk.white("Agent ID".padEnd(20)) + chalk.cyan("#" + agentId))
    console.log("  " + chalk.white("Name".padEnd(20)) + chalk.white(meta.name ?? "Unknown"))
    console.log("  " + chalk.white("Role".padEnd(20)) + chalk.yellow(meta.role ?? "unknown"))
    console.log("  " + chalk.white("Owner".padEnd(20)) + chalk.gray(owner))
    console.log("  " + chalk.white("Capabilities".padEnd(20)) + chalk.gray((meta.capabilities ?? []).join(", ")))
  } catch (e: any) {
    console.log(chalk.red("  Agent bulunamadı: " + e.message))
    return
  }

  // Reputation
  console.log(chalk.cyan("\n  ── Reputation ──────────────────"))
  try {
    const rep = await pub.readContract({
      address: CONTRACTS.REPUTATION_REGISTRY,
      abi: REPUTATION_ABI,
      functionName: "getReputation",
      args: [agentId],
    }) as [bigint, bigint]

    const totalScore = Number(rep[0])
    const count = Number(rep[1])

    if (count === 0) {
      console.log("  " + chalk.gray("No reputation yet — complete tasks to earn reviews"))
    } else {
      const avgScore = (totalScore / count).toFixed(1)
      const scoreColor = totalScore/count >= 80 ? chalk.green : chalk.yellow
      console.log("  " + chalk.white("Total Score".padEnd(20)) + scoreColor("+" + totalScore))
      console.log("  " + chalk.white("Reviews".padEnd(20)) + chalk.white(count + "x"))
      console.log("  " + chalk.white("Avg Score".padEnd(20)) + scoreColor(avgScore + "/100"))
    }
  } catch {
    console.log("  " + chalk.gray("No reputation yet"))
  }

  // Feedback events
  console.log(chalk.cyan("\n  ── Feedback History ────────────"))
  try {
    const feedbackLogs = await pub.getLogs({
      address: CONTRACTS.REPUTATION_REGISTRY,
      event: FEEDBACK_EVENT,
      args: { agentId },
      fromBlock,
      toBlock: latest,
    })

    if (feedbackLogs.length === 0) {
      console.log("  " + chalk.gray("No feedback in last 9000 blocks"))
    } else {
      console.log("  " + chalk.white("Feedback count".padEnd(20)) + chalk.green(feedbackLogs.length + " reviews"))
      feedbackLogs.slice(-3).forEach((log, i) => {
        const from = (log.args.clientAddress as string) ?? "unknown"
        console.log("  " + chalk.gray("  #" + (i+1) + " from " + from.slice(0,10) + "..." + from.slice(-6)))
      })
    }
  } catch {
    console.log("  " + chalk.gray("Could not fetch feedback events"))
  }

  // Job history — provider olarak katıldığı işler
  console.log(chalk.cyan("\n  ── Job History ─────────────────"))
  try {
    const agentOwner = await pub.readContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_ABI,
      functionName: "ownerOf",
      args: [agentId],
    }) as string

    // topic1=jobId, topic2=client, topic3=provider
    const paddedOwner = agentOwner.toLowerCase().replace("0x", "0x000000000000000000000000")
    
    const jobsAsProvider = await pub.getLogs({
      address: CONTRACTS.AGENTIC_COMMERCE,
      topics: [JOB_CREATED_TOPIC, null, null, paddedOwner as `0x${string}`],
      fromBlock, toBlock: latest,
    })

    const jobsAsClient = await pub.getLogs({
      address: CONTRACTS.AGENTIC_COMMERCE,
      topics: [JOB_CREATED_TOPIC, null, paddedOwner as `0x${string}`],
      fromBlock, toBlock: latest,
    })
    
    const completedAsProvider = await pub.getLogs({
      address: CONTRACTS.AGENTIC_COMMERCE,
      topics: [JOB_COMPLETED_TOPIC],
      fromBlock, toBlock: latest,
    })

    const totalJobs = jobsAsProvider.length + jobsAsClient.length
    const successRate = totalJobs > 0
      ? ((completedAsProvider.length / Math.max(jobsAsProvider.length, 1)) * 100).toFixed(1)
      : "N/A"

    console.log("  " + chalk.white("Jobs as Provider".padEnd(20)) + chalk.cyan(jobsAsProvider.length + " jobs"))
    console.log("  " + chalk.white("Jobs as Client".padEnd(20)) + chalk.cyan(jobsAsClient.length + " jobs"))
    console.log("  " + chalk.white("Completed".padEnd(20)) + chalk.green(completedAsProvider.length + " jobs"))
    console.log("  " + chalk.white("Success Rate".padEnd(20)) + chalk.cyan(successRate + (successRate !== "N/A" ? "%" : "")))
    console.log("  " + chalk.white("Total Jobs".padEnd(20)) + chalk.white(totalJobs + " jobs"))

    if (jobsAsProvider.length > 0) {
      const recentJobs = jobsAsProvider.slice(-3)
      console.log("  " + chalk.gray("  Recent jobs as provider:"))
      recentJobs.forEach((log, i) => {
        const jobId = log.topics[1] ? BigInt(log.topics[1]).toString() : "?"
        console.log("  " + chalk.gray("    Job #" + jobId + " | Block #" + log.blockNumber))
      })
    }
  } catch {
    console.log("  " + chalk.gray("Could not fetch job history"))
  }

  console.log(chalk.gray("\n  Explorer: https://testnet.arcscan.app/address/" + CONTRACTS.IDENTITY_REGISTRY))
  console.log(chalk.gray("  Token: https://testnet.arcscan.app/token/" + CONTRACTS.IDENTITY_REGISTRY + "/instance/" + agentId + "\n"))
}

export async function showNetworkStats() {
  const latest = await pub.getBlockNumber()
  const fromBlock = latest > 9000n ? latest - 9000n : 0n

  console.log(chalk.cyan.bold("\n╔══ Network Statistics ══╗"))
  console.log(chalk.gray("  Arc Testnet — Last 9000 blocks\n"))

  // Transfer events — kayıtlı agent sayısı
  const TRANSFER_EVENT = {
    type: "event" as const,
    name: "Transfer",
    inputs: [
      { type: "address" as const, name: "from", indexed: true },
      { type: "address" as const, name: "to", indexed: true },
      { type: "uint256" as const, name: "tokenId", indexed: true },
    ],
  }

  const mintLogs = await pub.getLogs({
    address: CONTRACTS.IDENTITY_REGISTRY,
    event: TRANSFER_EVENT,
    fromBlock, toBlock: latest,
  })
  const agents = mintLogs.filter(l => l.args.from === "0x0000000000000000000000000000000000000000")

  // Job events — raw topic
  const jobLogs = await pub.getLogs({
    address: CONTRACTS.AGENTIC_COMMERCE,
    topics: [JOB_CREATED_TOPIC],
    fromBlock, toBlock: latest,
  })

  // Completed jobs
  const completedLogs = await pub.getLogs({
    address: CONTRACTS.AGENTIC_COMMERCE,
    topics: [JOB_COMPLETED_TOPIC],
    fromBlock, toBlock: latest,
  })

  const feedbackLogs = await pub.getLogs({
    address: CONTRACTS.REPUTATION_REGISTRY,
    fromBlock, toBlock: latest,
  })

  // Unique owners
  const owners = new Set(agents.map(l => l.args.to as string))

  console.log("  " + chalk.white("Registered Agents".padEnd(25)) + chalk.cyan(agents.length))
  console.log("  " + chalk.white("Unique Owners".padEnd(25)) + chalk.cyan(owners.size))
  console.log("  " + chalk.white("Jobs Created".padEnd(25)) + chalk.green(jobLogs.length))
  console.log("  " + chalk.white("Jobs Completed".padEnd(25)) + chalk.green(completedLogs.length))
  const sr = jobLogs.length > 0 ? ((completedLogs.length / jobLogs.length) * 100).toFixed(1) + "%" : "N/A"
  console.log("  " + chalk.white("Success Rate".padEnd(25)) + chalk.cyan(sr))
  console.log("  " + chalk.white("Reputation Reviews".padEnd(25)) + chalk.yellow(feedbackLogs.length))
  console.log("  " + chalk.white("Current Block".padEnd(25)) + chalk.gray("#" + latest))
  console.log("  " + chalk.white("Block Range".padEnd(25)) + chalk.gray("#" + fromBlock + " – #" + latest))

  if (feedbackLogs.length > 0) {
    const topAgents = new Map<string, number>()
    feedbackLogs.forEach(l => {
      const id = l.args.agentId?.toString() ?? ""
      topAgents.set(id, (topAgents.get(id) ?? 0) + 1)
    })
    const sorted = [...topAgents.entries()].sort((a,b) => b[1] - a[1]).slice(0, 3)
    console.log(chalk.cyan("\n  ── Most Reviewed Agents ──────────"))
    sorted.forEach(([id, count]) => {
      console.log("  " + chalk.cyan(("#" + id).padEnd(12)) + chalk.yellow(count + " reviews"))
    })
  }

  console.log(chalk.gray("\n  Explorer: https://testnet.arcscan.app\n"))
}
