import { createPublicClient, http, slice, keccak256, toHex } from "viem"
import { ARC_TESTNET, CONTRACTS } from "./contracts/index.js"

const pub = createPublicClient({ chain: ARC_TESTNET, transport: http() })

async function main() {
  const latest = await pub.getBlockNumber()
  const fromBlock = latest > 9000n ? latest - 9000n : 0n

  // Tüm logları al — event adı olmadan
  const logs = await pub.getLogs({
    address: CONTRACTS.AGENTIC_COMMERCE,
    fromBlock,
    toBlock: latest,
  })

  console.log("Total logs:", logs.length)
  
  // Unique topic0'ları göster
  const topics = new Set(logs.map(l => l.topics[0]))
  console.log("\nUnique event selectors:")
  for (const t of topics) console.log(" ", t)

  // Feedback logs
  const repLogs = await pub.getLogs({
    address: CONTRACTS.REPUTATION_REGISTRY,
    fromBlock,
    toBlock: latest,
  })
  console.log("\nReputation logs:", repLogs.length)
  const repTopics = new Set(repLogs.map(l => l.topics[0]))
  for (const t of repTopics) console.log(" ", t)

  // Bilinen event selectors hesapla
  const events = [
    "JobCreated(uint256,address,address)",
    "JobFunded(uint256)",
    "JobSubmitted(uint256,bytes32)",
    "JobCompleted(uint256,bytes32)",
    "NewFeedback(uint256,address,uint256)",
    "FeedbackGiven(uint256,address,uint256)",
  ]
  console.log("\nExpected selectors:")
  for (const e of events) {
    const sel = slice(keccak256(toHex(e)), 0, 4)
    console.log(" ", slice(keccak256(toHex(e)), 0, 32), e)
  }
}

main().catch(console.error)
