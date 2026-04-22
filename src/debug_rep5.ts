import { createPublicClient, http, slice, keccak256, toHex } from "viem"
import { ARC_TESTNET } from "./contracts/index.js"

const pub = createPublicClient({ chain: ARC_TESTNET, transport: http() })

async function main() {
  const IMPL = "0x16e0fa7f7c56b9a767e34b192b51f921be31da34" as `0x${string}`
  const bytecode = await pub.getBytecode({ address: IMPL })
  
  if (!bytecode) { console.log("No bytecode"); return }
  console.log("Bytecode length:", bytecode.length)

  // Tüm olası giveFeedback imzalarını kontrol et
  const sigs = [
    "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
    "giveFeedback(uint256,int128,uint8,bytes32,bytes32,string,bytes32,bytes)",
    "giveFeedback(uint256,int128,uint8,bytes32,bytes32,string,bytes32)",
    "giveFeedback(uint256,uint8,bytes32,bytes32,string,bytes32,bytes)",
    "giveFeedback(uint256,int128,string,string,string,string,bytes32)",
    "authorizeFeedback(uint256,address,uint64,uint64)",
    "record(uint256,int256,string)",
  ]

  for (const sig of sigs) {
    const sel = slice(keccak256(toHex(sig)), 0, 4).replace("0x", "")
    const found = bytecode.includes(sel)
    console.log(found ? "✓" : "✗", sel, sig)
  }
}

main().catch(console.error)
