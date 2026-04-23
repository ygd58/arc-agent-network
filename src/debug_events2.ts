import { createPublicClient, http, slice, keccak256, toHex } from "viem"
import { ARC_TESTNET, CONTRACTS } from "./contracts/index.js"

const pub = createPublicClient({ chain: ARC_TESTNET, transport: http() })

async function main() {
  // Gerçek event adlarını bul
  const knownSelectors: Record<string, string> = {
    "0xb0f0239b": "?",
    "0x869e2577": "?",
    "0xe3fbcc1e": "?",
    "0x80c17db7": "?",
    "0x0fd54bd3": "?",
    "0x21d71db5": "?",
  }

  const candidates = [
    "JobCreated(uint256,address,address,uint256,string,address)",
    "JobCreated(uint256,address,address,uint256,uint256,string,address)",
    "JobFunded(uint256,address,uint256)",
    "JobFunded(uint256,uint256)",
    "JobSubmitted(uint256,address,bytes32)",
    "JobCompleted(uint256,address,bytes32)",
    "JobCancelled(uint256,address)",
    "BudgetSet(uint256,uint256)",
    "JobStateChanged(uint256,uint8)",
    "Transfer(address,address,uint256)",
    "Approval(address,address,uint256)",
    "NewFeedback(uint256,address,uint256,int128,uint8)",
    "FeedbackGiven(uint256,address,uint256,int128)",
  ]

  const actual = [
    "0xb0f0239bfdd96453e24733e18bfc24b70d8fadf123dd977473518dd577ee79b9",
    "0x869e2577b006bf47ee981cf6fec2e25583548081c14b98deab587f77b5068038",
    "0xe3fbcc1ea1bdc559ec7f0347efde7655e58b5f45a30b0e4470a583c3ef5496b3",
    "0x80c17db79857f338a6a6df68a6883ecc0ce78e2202fe61ed979733573f40538e",
    "0x0fd54bd364fa9e67f17b091aefe930932c09fe7651cf5ad02c71a418f3341444",
    "0x21d71db5be59bb9fa133895586b7404307dd33fb93b16db09dc6f1d9d7d231b0",
  ]

  console.log("Matching selectors:\n")
  for (const sig of candidates) {
    const full = keccak256(toHex(sig))
    if (actual.includes(full)) {
      console.log("✓ MATCH:", full.slice(0, 10), sig)
    }
  }
}

main().catch(console.error)
