import { keccak256, toHex } from "viem"

const actual = new Set([
  "0xb0f0239bfdd96453e24733e18bfc24b70d8fadf123dd977473518dd577ee79b9",
  "0x21d71db5be59bb9fa133895586b7404307dd33fb93b16db09dc6f1d9d7d231b0",
])

// Tüm kombinasyonları dene
const names = ["JobCreated", "JobCancelled", "JobExpired", "JobRejected", "JobUpdated", "ProviderSet", "EvaluatorSet"]
const types = ["uint256", "address", "bytes32", "uint8", "string", "int128", "bool"]

let found = 0
for (const name of names) {
  for (let n = 1; n <= 5; n++) {
    // n parametre kombinasyonları
    const combos = getCombos(types, n)
    for (const combo of combos) {
      const sig = `${name}(${combo.join(",")})`
      const full = keccak256(toHex(sig))
      if (actual.has(full)) {
        console.log("✓ MATCH:", sig)
        found++
      }
    }
  }
}
console.log("Searched. Found:", found)

function getCombos(arr: string[], n: number): string[][] {
  if (n === 1) return arr.map(x => [x])
  const result: string[][] = []
  for (const x of arr) {
    for (const rest of getCombos(arr, n-1)) {
      result.push([x, ...rest])
    }
  }
  return result
}
