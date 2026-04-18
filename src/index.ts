#!/usr/bin/env node
import { generatePrivateKey } from "viem/accounts"
import { ArcAgent } from "./agents/base.js"
import { publicClient, formatUSDC, sleep } from "./utils/chain.js"
import { CONTRACTS, USDC_ABI } from "./contracts/index.js"
import { TASK_TEMPLATES } from "./tasks/types.js"
import { orchestratorPrompt, workerPrompt, evaluatorPrompt } from "./tasks/prompts.js"
import { workerBid, selectBestWorker, displayAuction } from "./tasks/auction.js"
import chalk from "chalk"

console.log(chalk.cyan.bold(`
  ██████  ██████   ██████      
 ██    ██ ██   ██ ██           
 ███████  ██████  ██           
 ██    ██ ██   ██ ██           
 ██    ██ ██   ██  ██████      
`))
console.log(chalk.white.bold("  Arc Agent Network — Autonomous AI Agents on Arc Testnet\n"))
console.log(chalk.gray("  ERC-8004 Identity + ERC-8183 Commerce + Claude AI\n"))

const args = process.argv.slice(2)
const taskTypeArg = args[0]
const multiWorker = args.includes("--multi-worker")
const workerCount = args.includes("--workers") 
  ? parseInt(args[args.indexOf("--workers") + 1]) 
  : 3

function showTaskMenu() {
  console.log(chalk.cyan("  Available Task Types:\n"))
  for (const [key, t] of Object.entries(TASK_TEMPLATES)) {
    const diff = t.difficulty === "easy" ? chalk.green(t.difficulty) :
                 t.difficulty === "medium" ? chalk.yellow(t.difficulty) :
                 chalk.red(t.difficulty)
    console.log("  " + chalk.white(key.padEnd(25)) + " " + diff + "  " + t.budget + " USDC")
    console.log(chalk.gray("    " + t.title))
    console.log()
  }
  console.log(chalk.gray("  Usage:"))
  console.log(chalk.gray("    npx tsx src/index.ts <task_type>"))
  console.log(chalk.gray("    npx tsx src/index.ts <task_type> --multi-worker"))
  console.log(chalk.gray("    npx tsx src/index.ts <task_type> --multi-worker --workers 4"))
  console.log(chalk.gray("  Example:"))
  console.log(chalk.gray("    npx tsx src/index.ts data_analysis --multi-worker\n"))
}

async function checkBalance(address, label) {
  const bal = await publicClient.readContract({
    address: CONTRACTS.USDC, abi: USDC_ABI,
    functionName: "balanceOf", args: [address],
  })
  console.log("  " + label.padEnd(25) + " " + formatUSDC(bal) + " USDC")
  return bal
}

async function main() {
  if (!taskTypeArg || !TASK_TEMPLATES[taskTypeArg]) {
    showTaskMenu()
    return
  }

  const task = TASK_TEMPLATES[taskTypeArg]
  const mode = multiWorker ? chalk.cyan("MULTI-WORKER AUCTION") : chalk.white("SINGLE WORKER")

  console.log(chalk.cyan("╔══ Task Type ══╗"))
  console.log("  " + "Type".padEnd(20) + " " + task.type)
  console.log("  " + "Title".padEnd(20) + " " + task.title)
  console.log("  " + "Difficulty".padEnd(20) + " " + task.difficulty)
  console.log("  " + "Budget".padEnd(20) + " " + task.budget + " USDC")
  console.log("  " + "Mode".padEnd(20) + " " + mode)
  if (multiWorker) console.log("  " + "Workers".padEnd(20) + " " + workerCount + " competing")

  const orchestratorKey = process.env.ORCHESTRATOR_KEY ?? generatePrivateKey()
  const evaluatorKey    = process.env.EVALUATOR_KEY    ?? generatePrivateKey()

  const orchestrator = new ArcAgent({ name: "Orchestrator", role: "orchestrator", privateKey: orchestratorKey, capabilities: ["task-planning", "coordination"] })
  const evaluator    = new ArcAgent({ name: "Evaluator",    role: "evaluator",    privateKey: evaluatorKey,    capabilities: ["quality-assessment", task.type] })

  // Workers oluştur
  const workerKeys = []
  for (let i = 0; i < (multiWorker ? workerCount : 1); i++) {
    workerKeys.push(process.env["WORKER_KEY_" + (i+1)] ?? process.env.WORKER_KEY ?? generatePrivateKey())
  }

  const workers = workerKeys.map((key, i) => new ArcAgent({
    name: "Worker-" + (i+1),
    role: "worker",
    privateKey: key,
    capabilities: task.requiredSkills,
  }))

  console.log(chalk.cyan("\n╔══ Agent Network ══╗"))
  console.log("  " + "Orchestrator".padEnd(15) + " " + orchestrator.address)
  workers.forEach(w => console.log("  " + w.name.padEnd(15) + " " + w.address))
  console.log("  " + "Evaluator".padEnd(15) + " " + evaluator.address)

  console.log(chalk.cyan("\n╔══ Balances ══╗"))
  const orchBal = await checkBalance(orchestrator.address, "Orchestrator")
  for (const w of workers) await checkBalance(w.address, w.name)

  const minBal = BigInt(parseFloat(task.budget) * 1e6) + 1_000_000n
  if (orchBal < minBal) {
    console.log(chalk.red("\n✗ Insufficient balance: " + formatUSDC(orchBal) + " USDC"))
    console.log(chalk.yellow("  Required: " + task.budget + " USDC"))
    console.log(chalk.yellow("  Faucet: https://faucet.circle.com"))
    console.log(chalk.yellow("  Address: " + orchestrator.address + "\n"))
    return
  }

  // Phase 1: ERC-8004
  console.log(chalk.cyan("\n╔══ Phase 1: ERC-8004 Registration ══╗"))
  await orchestrator.register()
  await sleep(600)
  for (const w of workers) { await w.register(); await sleep(600) }
  await evaluator.register()

  // Phase 2: Task Assignment
  console.log(chalk.cyan("\n╔══ Phase 2: Task Assignment ══╗"))
  const assignmentRaw = await orchestrator.think(orchestratorPrompt(task, workers[0].capabilities))
  let assignment = {}
  try { assignment = JSON.parse(assignmentRaw) } catch { assignment = { task: task.description, budget: task.budget } }
  orchestrator.log(chalk.white("Task: " + (assignment.task ?? "").slice(0, 70) + "..."))

  // Phase 3: Worker Auction (multi-worker mode)
  let selectedWorker = workers[0]
  if (multiWorker && workers.length > 1) {
    console.log(chalk.cyan("\n╔══ Phase 3: Worker Auction ══╗"))
    orchestrator.log(chalk.white("Collecting bids from " + workers.length + " workers..."))

    const bids = []
    for (const w of workers) {
      const bid = await workerBid(w, task)
      w.log(chalk.white("Bid: " + bid.price + " USDC | " + bid.estimatedTime + " | " + bid.approach.slice(0, 50)))
      bids.push(bid)
      await sleep(500)
    }

    const result = await selectBestWorker(orchestrator, bids, task)
    displayAuction(bids, result)
    selectedWorker = result.winner
  }

  // Phase 4: ERC-8183 Job
  console.log(chalk.cyan("\n╔══ Phase " + (multiWorker ? "4" : "3") + ": ERC-8183 Job + Escrow ══╗"))
  const jobId = await orchestrator.createJob(
    selectedWorker.address,
    evaluator.address,
    "[" + task.type.toUpperCase() + "] " + (assignment.task ?? task.description),
    task.budget
  )

  // Phase 5: Worker Execute
  console.log(chalk.cyan("\n╔══ Phase " + (multiWorker ? "5" : "4") + ": Worker Executing ══╗"))
  await sleep(1500)
  const deliveryRaw = await selectedWorker.think(workerPrompt(task, assignment))
  let delivery = {}
  try { delivery = JSON.parse(deliveryRaw) } catch { delivery = { result: deliveryRaw } }
  selectedWorker.log(chalk.white("Result: " + (delivery.result ?? "").slice(0, 80) + "..."))
  if (delivery.key_findings) delivery.key_findings.slice(0, 3).forEach(f => selectedWorker.log(chalk.gray("  → " + f)))
  await selectedWorker.submitJob(jobId, JSON.stringify(delivery))

  // Phase 6: Evaluate
  console.log(chalk.cyan("\n╔══ Phase " + (multiWorker ? "6" : "5") + ": Evaluator Reviewing ══╗"))
  await sleep(1500)
  const evalRaw = await evaluator.think(evaluatorPrompt(task, assignment, delivery))
  let evaluation = {}
  try { evaluation = JSON.parse(evalRaw) } catch { evaluation = { approved: true, score: 80, comment: "Completed" } }
  evaluator.log(chalk.white("Score: " + evaluation.score + "/100"))
  evaluator.log(chalk.white(evaluation.comment ?? ""))
  if (evaluation.strengths) evaluation.strengths.forEach(s => evaluator.log(chalk.green("  + " + s)))
  if (evaluation.improvements) evaluation.improvements.forEach(i => evaluator.log(chalk.yellow("  ~ " + i)))

  // Phase 7: Settlement
  console.log(chalk.cyan("\n╔══ Phase " + (multiWorker ? "7" : "6") + ": Onchain Settlement ══╗"))
  if (evaluation.approved !== false && evaluation.recommendation !== "reject") {
    await evaluator.completeJob(jobId)
    await sleep(800)
    try { await evaluator.recordReputation(selectedWorker.agentId, evaluation.score ?? 80, evaluation.comment ?? "Good work") }
    catch { evaluator.log(chalk.gray("ℹ️  Reputation requires different wallet")) }
  } else {
    evaluator.log(chalk.red("✗ Job rejected"))
  }

  const orchBalAfter = await publicClient.readContract({ address: CONTRACTS.USDC, abi: USDC_ABI, functionName: "balanceOf", args: [orchestrator.address] })
  const winnerBalAfter = await publicClient.readContract({ address: CONTRACTS.USDC, abi: USDC_ABI, functionName: "balanceOf", args: [selectedWorker.address] })
  const orchBal2 = await publicClient.readContract({ address: CONTRACTS.USDC, abi: USDC_ABI, functionName: "balanceOf", args: [orchestrator.address] })

  console.log(chalk.green("\n╔══ Result ══╗"))
  console.log("  Task Type:     " + task.type)
  console.log("  Mode:          " + (multiWorker ? "Multi-Worker Auction" : "Single Worker"))
  if (multiWorker) console.log("  Workers:       " + workers.length + " competed, " + selectedWorker.name + " won")
  console.log("  Orchestrator:  #" + orchestrator.agentId)
  console.log("  Winner:        " + selectedWorker.name + " #" + selectedWorker.agentId)
  console.log("  Evaluator:     #" + evaluator.agentId)
  console.log("  Job ID:        #" + jobId)
  console.log("  Status:        " + (evaluation.approved !== false ? "Completed ✓" : "Rejected ✗"))
  console.log("  Score:         " + evaluation.score + "/100")
  console.log("  Explorer:      https://testnet.arcscan.app\n")
}

main().catch(e => { console.error(chalk.red("\n✗ Error: " + e.message + "\n")); process.exit(1) })
