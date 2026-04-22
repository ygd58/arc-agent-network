import { createPublicClient, http } from "viem"
import { ARC_TESTNET } from "./contracts/index.js"

const pub = createPublicClient({ chain: ARC_TESTNET, transport: http() })

async function main() {
  const REP = "0x8004B663056A597Dffe9eCcC1965A193B7388713" as `0x${string}`

  // EIP-1967 implementation slot
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  const impl = await pub.getStorageAt({ address: REP, slot: implSlot as `0x${string}` })
  console.log("Implementation:", impl)

  // EIP-1967 admin slot
  const adminSlot = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"
  const admin = await pub.getStorageAt({ address: REP, slot: adminSlot as `0x${string}` })
  console.log("Admin:", admin)
}

main().catch(console.error)
