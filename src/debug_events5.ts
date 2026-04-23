import { createPublicClient, http } from "viem"
import { ARC_TESTNET, CONTRACTS } from "./contracts/index.js"

const pub = createPublicClient({ chain: ARC_TESTNET, transport: http() })

async function main() {
  const latest = await pub.getBlockNumber()
  const fromBlock = latest > 9000n ? latest - 9000n : 0n

  const logs = await pub.getLogs({
    address: CONTRACTS.AGENTIC_COMMERCE,
    fromBlock, toBlock: latest,
  })

  const unknown = logs.filter(l => 
    l.topics[0] === "0xb0f0239bfdd96453e24733e18bfc24b70d8fadf123dd977473518dd577ee79b9" ||
    l.topics[0] === "0x21d71db5be59bb9fa133895586b7404307dd33fb93b16db09dc6f1d9d7d231b0"
  )

  console.log("Unknown logs:", unknown.length)
  unknown.slice(0, 3).forEach((log, i) => {
    console.log("\nLog", i+1)
    console.log("  topic0:", log.topics[0])
    console.log("  topic1:", log.topics[1])
    console.log("  topic2:", log.topics[2])
    console.log("  topic3:", log.topics[3])
    console.log("  data:", log.data.slice(0, 100))
    console.log("  tx:", log.transactionHash)
  })
}

main().catch(console.error)
