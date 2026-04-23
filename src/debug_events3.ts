import { keccak256, toHex } from "viem"

const actual = [
  "0xb0f0239bfdd96453e24733e18bfc24b70d8fadf123dd977473518dd577ee79b9",
  "0x21d71db5be59bb9fa133895586b7404307dd33fb93b16db09dc6f1d9d7d231b0",
]

const candidates = [
  "JobCreated(uint256,address,address,address,uint256,string,address)",
  "JobCreated(uint256,address,address,address,uint256,uint256,string)",
  "JobCreated(uint256,address,address,address,string,address)",
  "JobCreated(uint256,address,address,address,uint256,string)",
  "JobCreated(uint256,address,address,uint256,string)",
  "JobCancelled(uint256,address,bytes32)",
  "JobCancelled(uint256,bytes32)",
  "JobCancelled(uint256)",
  "JobExpired(uint256)",
  "JobExpired(uint256,address)",
  "JobRejected(uint256,address,bytes32)",
  "JobDisputed(uint256,address)",
  "FeedbackGiven(uint256,address,uint256,int128,uint8)",
  "NewFeedback(uint256,address,uint256,int128,uint8,bytes32)",
]

for (const sig of candidates) {
  const full = keccak256(toHex(sig))
  if (actual.includes(full)) {
    console.log("✓ MATCH:", sig)
  }
}
console.log("Done")
