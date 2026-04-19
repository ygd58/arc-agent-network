import { keccak256, toHex } from "viem"
import { newClient, publicClient, parseUSDC, formatUSDC, sleep } from "../utils/chain.js"
import { askClaude } from "../utils/claude.js"
import {
  CONTRACTS, IDENTITY_ABI, REPUTATION_ABI,
  COMMERCE_ABI, USDC_ABI
} from "../contracts/index.js"
import chalk from "chalk"

export type AgentRole = "orchestrator" | "worker" | "evaluator"

export type AgentConfig = {
  name: string
  role: AgentRole
  privateKey: string
  capabilities: string[]
}

export class ArcAgent {
  name: string
  role: AgentRole
  capabilities: string[]
  agentId: bigint = 0n
  private pk: string
  private clients: ReturnType<typeof newClient>

  constructor(config: AgentConfig) {
    this.name = config.name
    this.role = config.role
    this.capabilities = config.capabilities
    this.pk = config.privateKey
    this.clients = newClient(config.privateKey)
  }

  get address() { return this.clients.account.address }

  log(msg: string) {
    const roleColor = {
      orchestrator: chalk.magenta,
      worker: chalk.cyan,
      evaluator: chalk.yellow,
    }[this.role]
    console.log(`  ${roleColor(`[${this.name}]`)} ${msg}`)
  }

  async getBalance(): Promise<bigint> {
    return publicClient.readContract({
      address: CONTRACTS.USDC,
      abi: USDC_ABI,
      functionName: "balanceOf",
      args: [this.address],
    }) as Promise<bigint>
  }

  // ERC-8004: Agent'ı zincire kaydet
  async register(): Promise<bigint> {
    const metadata = {
      name: this.name,
      role: this.role,
      capabilities: this.capabilities,
      version: "1.0.0",
      created: new Date().toISOString(),
      owner: this.address,
      network: "Arc Testnet",
    }

    const uri = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`

    const hash = await this.clients.wallet.writeContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: IDENTITY_ABI,
      functionName: "register",
      args: [uri],
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    const tokenId = receipt.logs[0] ? BigInt(receipt.logs[0].topics[3] ?? "0x0") : 0n
    this.agentId = tokenId

    this.log(chalk.green(`✓ ERC-8004 kayıt — Agent ID: ${tokenId}`))
    this.log(chalk.gray(`  TX: ${hash.slice(0, 20)}...`))
    return tokenId
  }

  // ERC-8004: Reputation kaydet
  async recordReputation(targetAgentId: bigint, score: number, comment: string) {
    const hash = await this.clients.wallet.writeContract({
      address: CONTRACTS.REPUTATION_REGISTRY,
      abi: REPUTATION_ABI,
      functionName: "record",
      args: [targetAgentId, BigInt(score), comment],
    })
    await publicClient.waitForTransactionReceipt({ hash })
    this.log(chalk.green(`✓ Reputation kaydedildi — Agent #${targetAgentId}: ${score > 0 ? "+" : ""}${score}`))
  }

  // ERC-8183: İş oluştur
  async createJob(provider: string, evaluator: string, description: string, budget: string): Promise<bigint> {
    const expiredAt = BigInt(Math.floor(Date.now() / 1000) + 7 * 86400)
    const budgetUnits = parseUSDC(budget)

    const hash = await this.clients.wallet.writeContract({
      address: CONTRACTS.AGENTIC_COMMERCE,
      abi: COMMERCE_ABI,
      functionName: "createJob",
      args: [
        provider as `0x${string}`,
        evaluator as `0x${string}`,
        expiredAt,
        description,
        "0x0000000000000000000000000000000000000000",
      ],
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    const jobId = receipt.logs[0] ? BigInt(receipt.logs[0].topics[1] ?? "0x1") : 1n

    this.log(chalk.green(`✓ İş oluşturuldu — Job ID: ${jobId}`))
    this.log(chalk.gray(`  Bütçe: ${budget} USDC | TX: ${hash.slice(0, 20)}...`))

    // Fund job
    await this.fundJob(jobId, budgetUnits)
    return jobId
  }

  // ERC-8183: İşi fonla
  async fundJob(jobId: bigint, budgetUnits: bigint) {
    const approveHash = await this.clients.wallet.writeContract({
      address: CONTRACTS.USDC,
      abi: USDC_ABI,
      functionName: "approve",
      args: [CONTRACTS.AGENTIC_COMMERCE, budgetUnits],
    })
    await publicClient.waitForTransactionReceipt({ hash: approveHash })

    const setBudgetHash = await this.clients.wallet.writeContract({
      address: CONTRACTS.AGENTIC_COMMERCE,
      abi: COMMERCE_ABI,
      functionName: "setBudget",
      args: [jobId, budgetUnits, "0x"],
    })
    await publicClient.waitForTransactionReceipt({ hash: setBudgetHash })

    const fundHash = await this.clients.wallet.writeContract({
      address: CONTRACTS.AGENTIC_COMMERCE,
      abi: COMMERCE_ABI,
      functionName: "fund",
      args: [jobId, "0x"],
    })
    await publicClient.waitForTransactionReceipt({ hash: fundHash })
    this.log(chalk.green(`✓ ${formatUSDC(budgetUnits)} escrow'a kilitlendi`))
  }

  // ERC-8183: İş teslim et
  async submitJob(jobId: bigint, deliverable: string) {
    const hash = await this.clients.wallet.writeContract({
      address: CONTRACTS.AGENTIC_COMMERCE,
      abi: COMMERCE_ABI,
      functionName: "submit",
      args: [jobId, keccak256(toHex(deliverable)) as `0x${string}`, "0x"],
    })
    await publicClient.waitForTransactionReceipt({ hash })
    this.log(chalk.green(`✓ Teslim edildi — Job #${jobId}`))
    this.log(chalk.gray(`  Hash: ${keccak256(toHex(deliverable)).slice(0, 20)}...`))
  }

  // ERC-8183: İşi onayla
  async completeJob(jobId: bigint) {
    const hash = await this.clients.wallet.writeContract({
      address: CONTRACTS.AGENTIC_COMMERCE,
      abi: COMMERCE_ABI,
      functionName: "complete",
      args: [jobId, keccak256(toHex("approved")) as `0x${string}`, "0x"],
    })
    await publicClient.waitForTransactionReceipt({ hash })
    this.log(chalk.green(`✓ İş tamamlandı — USDC ödendi`))
  }

  // ERC-8183: İşi reddet
  async rejectJob(jobId: bigint, reason: string) {
    const hash = await this.clients.wallet.writeContract({
      address: CONTRACTS.AGENTIC_COMMERCE,
      abi: COMMERCE_ABI,
      functionName: "complete",
      args: [jobId, keccak256(toHex("rejected-" + reason)) as `0x${string}`, "0x"],
    })
    await publicClient.waitForTransactionReceipt({ hash })
    this.log(chalk.red(`✗ İş reddedildi — Job #${jobId}`))
    this.log(chalk.gray(`  Sebep: ${reason}`))
  }

  // ERC-8183: İşi reddet
  async rejectJob(jobId: bigint, reason: string) {
    const hash = await this.clients.wallet.writeContract({
      address: CONTRACTS.AGENTIC_COMMERCE,
      abi: COMMERCE_ABI,
      functionName: "complete",
      args: [jobId, keccak256(toHex("rejected-" + reason)) as `0x${string}`, "0x"],
    })
    await publicClient.waitForTransactionReceipt({ hash })
    this.log(chalk.red(`✗ İş reddedildi — Job #${jobId}`))
    this.log(chalk.gray(`  Sebep: ${reason}`))
  }

  // Claude API ile karar al
  async think(prompt: string): Promise<string> {
    this.log(chalk.gray(`🤔 Düşünüyor...`))
    const response = await askClaude(prompt)
    return response
  }
}
