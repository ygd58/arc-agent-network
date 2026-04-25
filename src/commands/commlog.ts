// Agent Communication Log — onchain mesajları kaydet ve oku
import { createPublicClient, createWalletClient, http, keccak256, toHex } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { ARC_TESTNET } from "../contracts/index.js"
import chalk from "chalk"

const pub = createPublicClient({ chain: ARC_TESTNET, transport: http() })

// AgentMessage event — onchain log olarak kaydedilir
// Gerçek kontrat yerine TX data olarak saklıyoruz (gas verimli)
const AGENT_LOG_ADDRESS = "0x0000000000000000000000000000000000000000" as const

export type AgentMessage = {
  from: string
  to: string
  jobId: bigint
  messageType: "task_assign" | "bid" | "deliverable" | "feedback" | "status"
  content: string
  timestamp: Date
  txHash?: string
}

export class AgentCommLogger {
  private messages: AgentMessage[] = []
  private privateKey: string

  constructor(privateKey: string) {
    this.privateKey = privateKey
  }

  // Mesajı in-memory log'a ekle + onchain TX olarak kaydet
  async log(msg: Omit<AgentMessage, "timestamp" | "txHash">): Promise<AgentMessage> {
    const message: AgentMessage = {
      ...msg,
      timestamp: new Date(),
    }

    // Onchain kayıt — 0x0 adresine 0 USDC + data gönder
    try {
      const account = privateKeyToAccount(this.privateKey as `0x${string}`)
      const wallet = createWalletClient({ account, chain: ARC_TESTNET, transport: http() })

      const logData = JSON.stringify({
        type: "arc-agent-msg",
        jobId: msg.jobId.toString(),
        msgType: msg.messageType,
        from: msg.from.slice(0, 10),
        to: msg.to.slice(0, 10),
        content: msg.content.slice(0, 100),
      })

      const hash = await wallet.sendTransaction({
        to: account.address, // kendi adresine
        value: 0n,
        data: toHex(logData) as `0x${string}`,
      })

      message.txHash = hash
    } catch {
      // Onchain kayıt başarısız olsa bile devam et
    }

    this.messages.push(message)
    return message
  }

  // Mesajları göster
  display(jobId?: bigint) {
    const filtered = jobId
      ? this.messages.filter(m => m.jobId === jobId)
      : this.messages

    if (filtered.length === 0) {
      console.log(chalk.gray("  No messages logged"))
      return
    }

    console.log(chalk.cyan(`\n╔══ Agent Communication Log (${filtered.length} messages) ══╗`))

    filtered.forEach((msg, i) => {
      const typeColor = {
        task_assign: chalk.magenta,
        bid: chalk.blue,
        deliverable: chalk.cyan,
        feedback: chalk.yellow,
        status: chalk.gray,
      }[msg.messageType] ?? chalk.white

      const time = msg.timestamp.toLocaleTimeString("tr-TR")
      console.log(
        chalk.gray(`  [${time}]`) + " " +
        typeColor(`[${msg.messageType.toUpperCase()}]`) + " " +
        chalk.white(`${msg.from.slice(0,8)}→${msg.to.slice(0,8)}`) +
        chalk.gray(` Job#${msg.jobId}`)
      )
      console.log(chalk.gray(`    ${msg.content.slice(0, 80)}`))
      if (msg.txHash) {
        console.log(chalk.gray(`    TX: ${msg.txHash.slice(0, 20)}...`))
      }
    })
    console.log()
  }

  getMessages() { return [...this.messages] }
  clear() { this.messages = [] }
}

// Global logger instance
let _logger: AgentCommLogger | null = null

export function getLogger(privateKey?: string): AgentCommLogger {
  if (!_logger) {
    _logger = new AgentCommLogger(privateKey ?? process.env.ORCHESTRATOR_KEY ?? "0x0")
  }
  return _logger
}
