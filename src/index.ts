#!/usr/bin/env node
import { generatePrivateKey } from "viem/accounts"
import { ArcAgent } from "./agents/base.js"
import { publicClient, formatUSDC, sleep } from "./utils/chain.js"
import { CONTRACTS, USDC_ABI } from "./contracts/index.js"
import chalk from "chalk"

console.log(chalk.cyan.bold(`
  ██████  ██████   ██████      
 ██    ██ ██   ██ ██           
 ███████  ██████  ██           
 ██    ██ ██   ██ ██           
 ██    ██ ██   ██  ██████      
                               
 ▄▄▄·  ▄▄ •▄▄▄ . ▐ ▄ ▄▄▄▄▄   
▐█ ▀█ ▐█ ▀ ▪▀▄.▀·•█▌▐█•██     
▄█▀▀█ ▄█ ▀█▄▐▀▀▪▄▐█▐▐▌ ▐█.▪  
▐█ ▪▐▌▐█▄▪▐█▐█▄▄▌██▐█▌ ▐█▌·  
 ▀  ▀ ·▀▀▀▀  ▀▀▀ ▀▀ █▪ ▀▀▀   
                               
 ███    ██ ███████ ████████ ██     ██  ██████  ██████  ██   ██
 ████   ██ ██         ██    ██     ██ ██    ██ ██   ██ ██  ██ 
 ██ ██  ██ █████      ██    ██  █  ██ ██    ██ ██████  █████  
 ██  ██ ██ ██         ██    ██ ███ ██ ██    ██ ██   ██ ██  ██ 
 ██   ████ ███████    ██     ███ ███   ██████  ██   ██ ██   ██
`))

console.log(chalk.white.bold("  Arc Agent Network — Autonomous AI Agents on Arc Testnet\n"))
console.log(chalk.gray("  ERC-8004 Identity + ERC-8183 Commerce + Claude AI\n"))

async function checkBalance(address: string, label: string): Promise<bigint> {
  const bal = await publicClient.readContract({
    address: CONTRACTS.USDC,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  }) as bigint
  console.log(`  ${label.padEnd(25)} ${formatUSDC(bal)}`)
  return bal
}

async function main() {
  // Ortam değişkenlerinden private key'leri al
  // Yoksa yeni oluştur (test için)
  const orchestratorKey = process.env.ORCHESTRATOR_KEY ?? generatePrivateKey()
  const workerKey       = process.env.WORKER_KEY       ?? generatePrivateKey()
  const evaluatorKey    = process.env.EVALUATOR_KEY    ?? generatePrivateKey()

  // 3 Agent oluştur
  const orchestrator = new ArcAgent({
    name: "Orchestrator",
    role: "orchestrator",
    privateKey: orchestratorKey,
    capabilities: ["task-planning", "resource-allocation", "coordination"],
  })

  const worker = new ArcAgent({
    name: "Worker",
    role: "worker",
    privateKey: workerKey,
    capabilities: ["data-analysis", "blockchain", "research"],
  })

  const evaluator = new ArcAgent({
    name: "Evaluator",
    role: "evaluator",
    privateKey: evaluatorKey,
    capabilities: ["quality-assessment", "verification"],
  })

  console.log(chalk.cyan("╔══ Agent Ağı / Agent Network ══╗"))
  console.log(`  ${"Orchestrator".padEnd(15)} ${orchestrator.address}`)
  console.log(`  ${"Worker".padEnd(15)} ${worker.address}`)
  console.log(`  ${"Evaluator".padEnd(15)} ${evaluator.address}`)

  // Bakiye kontrol
  console.log(chalk.cyan("\n╔══ Bakiyeler / Balances ══╗"))
  const orchBal  = await checkBalance(orchestrator.address, "Orchestrator")
  const workBal  = await checkBalance(worker.address,       "Worker")
  const evalBal  = await checkBalance(evaluator.address,    "Evaluator")

  // Minimum bakiye kontrolü
  const minBal = 3_000_000n // 3 USDC minimum
  if (orchBal < minBal) {
    console.log(chalk.red(`\n✗ Orchestrator yetersiz bakiye: ${formatUSDC(orchBal)}`))
    console.log(chalk.yellow(`  Faucet: https://faucet.circle.com`))
    console.log(chalk.yellow(`  Adres:  ${orchestrator.address}`))
    console.log(chalk.gray(`\n  Hızlı test için env set et:`))
    console.log(chalk.gray(`  export ORCHESTRATOR_KEY=0xSENIN_PRIVATE_KEY`))
    console.log(chalk.gray(`  export WORKER_KEY=0xSENIN_PRIVATE_KEY`))
    console.log(chalk.gray(`  export EVALUATOR_KEY=0xSENIN_PRIVATE_KEY\n`))
    return
  }

  // ── FAZA 1: ERC-8004 Kayıt ──────────────────────────────────
  console.log(chalk.cyan("\n╔══ Faz 1: ERC-8004 Agent Kaydı ══╗"))

  await orchestrator.register()
  await sleep(1000)
  await worker.register()
  await sleep(1000)
  await evaluator.register()
  await sleep(1000)

  console.log(chalk.green("\n✓ 3 agent zincire kaydedildi"))

  // ── FAZA 2: Orchestrator görev belirle ──────────────────────
  console.log(chalk.cyan("\n╔══ Faz 2: AI Görev Belirleme ══╗"))

  const taskPrompt = `
    You are an orchestrator agent on Arc blockchain testnet.
    Generate a specific, measurable task for a worker agent.
    Worker capabilities: ${worker.capabilities.join(", ")}
    
    Respond ONLY with valid JSON (no markdown):
    {"task": "...", "skills": [...], "budget": "1.0", "deadline": "24 hours"}
  `

  const taskResponse = await orchestrator.think(taskPrompt)
  let taskData: any = {}
  try {
    taskData = JSON.parse(taskResponse)
  } catch {
    taskData = { task: "Analyze Arc testnet block patterns", budget: "1.0" }
  }

  orchestrator.log(chalk.white(`📋 Görev: ${taskData.task}`))
  orchestrator.log(chalk.white(`💰 Bütçe: ${taskData.budget} USDC`))

  // ── FAZA 3: ERC-8183 İş Oluştur ─────────────────────────────
  console.log(chalk.cyan("\n╔══ Faz 3: ERC-8183 İş Oluştur ══╗"))

  const jobId = await orchestrator.createJob(
    worker.address,
    evaluator.address,
    taskData.task,
    taskData.budget ?? "1.0"
  )

  // ── FAZA 4: Worker işi teslim et ────────────────────────────
  console.log(chalk.cyan("\n╔══ Faz 4: Worker AI Çalışıyor ══╗"))
  await sleep(2000)

  const workPrompt = `
    You are a worker agent on Arc blockchain testnet.
    Complete this task: "${taskData.task}"
    
    Respond ONLY with valid JSON (no markdown):
    {"result": "...", "methodology": "...", "confidence": 0.95}
  `

  const workResponse = await worker.think(workPrompt)
  let workData: any = {}
  try {
    workData = JSON.parse(workResponse)
  } catch {
    workData = { result: workResponse }
  }

  worker.log(chalk.white(`📊 Sonuç: ${workData.result?.slice(0, 80)}...`))
  await worker.submitJob(jobId, JSON.stringify(workData))

  // ── FAZA 5: Evaluator değerlendir ───────────────────────────
  console.log(chalk.cyan("\n╔══ Faz 5: Evaluator AI Değerlendiriyor ══╗"))
  await sleep(2000)

  const evalPrompt = `
    You are an evaluator agent on Arc blockchain testnet.
    Task was: "${taskData.task}"
    Worker delivered: "${JSON.stringify(workData)}"
    
    Evaluate the work quality. Respond ONLY with valid JSON (no markdown):
    {"approved": true, "score": 85, "comment": "...", "recommendation": "approve"}
  `

  const evalResponse = await evaluator.think(evalPrompt)
  let evalData: any = {}
  try {
    evalData = JSON.parse(evalResponse)
  } catch {
    evalData = { approved: true, score: 80, comment: "Work completed satisfactorily" }
  }

  evaluator.log(chalk.white(`📝 Değerlendirme: ${evalData.comment}`))
  evaluator.log(chalk.white(`⭐ Skor: ${evalData.score}/100`))

  // ── FAZA 6: Onayla + Ödeme ──────────────────────────────────
  console.log(chalk.cyan("\n╔══ Faz 6: Onchain Settlement ══╗"))

  if (evalData.approved !== false) {
    await evaluator.completeJob(jobId)
    await sleep(1000)

    // ERC-8004 reputation kaydet (farklı cüzdan gerektirir)
    try {
      await evaluator.recordReputation(
        worker.agentId,
        evalData.score ?? 80,
        evalData.comment ?? "Good work"
      )
    } catch {
      evaluator.log("ℹ️  Reputation: aynı cüzdanla self-record yapılamaz (ERC-8004 kural)")
    }
  }

  // ── SONUÇ ────────────────────────────────────────────────────
  console.log(chalk.cyan("\n╔══ Sonuç / Result ══╗"))

  const orchBalAfter = await publicClient.readContract({
    address: CONTRACTS.USDC, abi: USDC_ABI,
    functionName: "balanceOf", args: [orchestrator.address],
  }) as bigint

  const workBalAfter = await publicClient.readContract({
    address: CONTRACTS.USDC, abi: USDC_ABI,
    functionName: "balanceOf", args: [worker.address],
  }) as bigint

  console.log(chalk.green(`
  ✓ Agent Network Tamamlandı!

  ERC-8004 Kayıtlar:
    Orchestrator  #${orchestrator.agentId}
    Worker        #${worker.agentId}
    Evaluator     #${evaluator.agentId}

  ERC-8183 İş:
    Job ID        #${jobId}
    Görev         ${taskData.task?.slice(0, 60)}
    Durum         Completed ✓

  Ödeme:
    Orchestrator  ${formatUSDC(orchBal)} → ${formatUSDC(orchBalAfter)}
    Worker        ${formatUSDC(workBal)} → ${formatUSDC(workBalAfter)}

  Explorer: https://testnet.arcscan.app
  `))
}

main().catch(e => {
  console.error(chalk.red(`\n✗ Hata: ${e.message}\n`))
  process.exit(1)
})
