import { createPublicClient, http } from "viem"
import { ARC_TESTNET } from "./contracts/index.js"

const pub = createPublicClient({ chain: ARC_TESTNET, transport: http() })

async function main() {
  // Kontratın ABI'sini bytecode'dan çıkaramayız ama 
  // Arc docs'tan gelen imzayı deneyelim
  // giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)
  // 8 parametre — bizim çağrımızda da 8 parametre vardı
  
  // "too many" hatası — belki Arc'ın versiyonu farklı parametre sayısı
  // 7 parametrelik versiyon deneyelim
  console.log("Arc testnet RPC bağlantısı test ediliyor...")
  const block = await pub.getBlockNumber()
  console.log("Blok:", block)
  
  // Function selector hesapla
  const { keccak256, toHex, slice } = await import("viem")
  const sig8 = "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)"
  const selector8 = slice(keccak256(toHex(sig8)), 0, 4)
  console.log("8 param selector:", selector8)
}

main().catch(console.error)
