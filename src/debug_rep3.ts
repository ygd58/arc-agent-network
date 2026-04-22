import { createPublicClient, http, slice, keccak256, toHex } from "viem"
import { ARC_TESTNET } from "./contracts/index.js"

const pub = createPublicClient({ chain: ARC_TESTNET, transport: http() })

async function main() {
  const REP = "0x8004B663056A597Dffe9eCcC1965A193B7388713" as `0x${string}`

  // Farklı giveFeedback imzalarını dene
  const sigs = [
    "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
    "giveFeedback(uint256,int128,uint8,bytes32,bytes32,string,bytes32,bytes)",
    "giveFeedback(uint256,int128,uint8,bytes32,bytes32,string,bytes32)",
    "giveFeedback(uint256,uint8,bytes32,bytes32,string,bytes32,bytes)",
    "authorizeFeedback(uint256,address,uint64,uint64)",
  ]

  for (const sig of sigs) {
    const selector = slice(keccak256(toHex(sig)), 0, 4)
    console.log(selector, sig)
  }

  // Kontrat bytecode'ından selector ara
  const bytecode = await pub.getBytecode({ address: REP })
  if (bytecode) {
    console.log("\nBytecode length:", bytecode.length)
    // 3c036a7e selector var mı?
    console.log("3c036a7e (8param) found:", bytecode.includes("3c036a7e"))
  }
}

main().catch(console.error)
