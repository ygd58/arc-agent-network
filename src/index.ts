#!/usr/bin/env node
import { generatePrivateKey } from "viem/accounts"
import { ArcAgent } from "./agents/base.js"
import { publicClient, formatUSDC, sleep } from "./utils/chain.js"
import { CONTRACTS, USDC_ABI } from "./contracts/index.js"
import { TASK_TEMPLATES } from "./tasks/types.js"
import { orchestratorPrompt, workerPrompt, evaluatorPrompt } from "./tasks/prompts.js"
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
  console.log(chalk.gray("  Usage:   npx tsx src/index.ts <task_type>"))
  console.log(chalk.gray("  Example: npx tsx src/index.ts data_analysis\n"))
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

  console.log(chalk.cyan("╔══ Task Type ══╗"))
  console.log("  " + "Type".padEnd(20) + " " + task.type)
  console.log("  " + "Title".padEnd(20) + " " + task.title)
  console.log("  " + "Difficulty".padEnd(20) + " " + task.difficulty)
  console.log("  " + "Budget".padEnd(20) + " " + task.budget + " USDC")
  console.log("  " + "Skills".padEnd(20) + " " + task.requiredSkills.join(", "))

  const orchestratorKey = process.env.ORCHESTRATOR_KEY ?? generatePrivateKey()
  const workerKey       = process.env.WORKER_KEY       ?? generatePrivateKey()
  const evaluatorKey    = process.env.EVALUATOR_KEY    ?? generatePrivateKey()

  const orchestrator = new ArcAgent({ name: "Orchestrator", role: "orchestrator", privateKey: orchestratorKey, capabilities: ["task-planning", "coordination"] })
  const worker       = new ArcAgent({ name: "Worker",       role: "worker",       privateKey: workerKey,       capabilities: task.requiredSkills })
  const evaluator    = new ArcAgent({ name: "Evaluator",    role: "evaluator",    privateKey: evaluatorKey,    capabilities: ["quality-assessment", task.type] })

  console.log(chalk.cyan("\n╔══ Agent Network ══╗"))
  console.log("  " + "Orchestrator".padEnd(15) + " " + orchestrator.address)
  console.log("  " + "Worker".padEnd(15) + " " + worker.address)
  console.log("  " + "Evaluator".padEnd(15) + " " + evaluator.address)

  console.log(chalk.cyan("\n╔══ Balances ══╗"))
  const orchBal = await checkBalance(orchestrator.address, "Orchestrator")
  const workBal = await checkBalance(worker.address, "Worker")
  await checkBalance(evaluator.address, "Evaluator")

  const minBal = BigInt(parseFloat(task.budget) * 1e6) + 1_000_000n
  if (orchBal < minBal) {
    console.log(chalk.red("\n✗ Insufficient balance: " + formatUSDC(orchBal) + " USDC"))
    console.log(chalk.yellow("  Required: " + task.budget + " USDC"))
    console.log(chalk.yellow("  Faucet: https://faucet.circle.com"))
    console.log(chalk.yellow("  Address: " + orchestrator.address + "\n"))
    return
  }

  console.log(chalk.cyan("\n╔══ Phase 1: ERC-8004 Registration ══╗"))
  await orchestrator.register()
  await sleep(800)
  await worker.register()
  await sleep(800)
  await evaluator.register()

  console.log(chalk.cyan("\n╔══ Phase 2: Task Assignment ══╗"))
  const assignmentRaw = await orchestrator.think(orchestratorPrompt(task, worker.capabilities))
  let assignment = {}
  try { assignment = JSON.parse(assignmentRaw) } catch { assignment = { task: task.description, budget: task.budget } }
  orchestrator.log(chalk.white("Task: " + (assignment.task ?? "").slice(0, 70) + "..."))
  if (assignment.acceptance_criteria) {
    assignment.acceptance_criteria.forEach(c => orchestrator.log(chalk.gray("  ✓ " + c)))
  }

  console.log(chalk.cyan("\n╔══ Phase 3: ERC-8183 Job + Escrow ══╗"))
  const jobId = await orchestrator.createJob(worker.address, evaluator.address, "[" + task.type.toUpperCase() + "] " + (assignment.task ?? task.description), task.budget)

  console.log(chalk.cyan("\n╔══ Phase 4: Worker Executing ══╗"))
  await sleep(1500)
  const deliveryRaw = await worker.think(workerPrompt(task, assignment))
  let delivery = {}
  try { delivery = JSON.parse(deliveryRaw) } catch { delivery = { result: deliveryRaw } }
  worker.log(chalk.white("Result: " + (delivery.result ?? "").slice(0, 80) + "..."))
  if (delivery.key_findings) {
    delivery.key_findings.slice(0, 3).forEach(f => worker.log(chalk.gray("  → " + f)))
  }
  await worker.submitJob(jobId, JSON.stringify(delivery))

  console.log(chalk.cyan("\n╔══ Phase 5: Evaluator Reviewing ══╗"))
  await sleep(1500)
  const evalRaw = await evaluator.think(evaluatorPrompt(task, assignment, delivery))
  let evaluation = {}
  try { evaluation = JSON.parse(evalRaw) } catch { evaluation = { approved: true, score: 80, comment: "Completed" } }
  evaluator.log(chalk.white("Score: " + evaluation.score + "/100"))
  evaluator.log(chalk.white(evaluation.comment ?? ""))
  if (evaluation.strengths) evaluation.strengths.forEach(s => evaluator.log(chalk.green("  + " + s)))
  if (evaluation.improvements) evaluation.improvements.forEach(i => evaluator.log(chalk.yellow("  ~ " + i)))

  console.log(chalk.cyan("\n╔══ Phase 6: Onchain Settlement ══╗"))
  if (evaluation.approved !== false && evaluation.recommendation !== "reject") {
    await evaluator.completeJob(jobId)
    await sleep(800)
    try { await evaluator.recordReputation(worker.agentId, evaluation.score ?? 80, evaluation.comment ?? "Good work") }
    catch { evaluator.log(chalk.gray("ℹ️  Reputation requires different wallet")) }
  } else {
    evaluator.log(chalk.red("✗ Job rejected"))
  }

  const orchBalAfter = await publicClient.readContract({ address: CONTRACTS.USDC, abi: USDC_ABI, functionName: "balanceOf", args: [orchestrator.address] })
  const workBalAfter = await publicClient.readContract({ address: CONTRACTS.USDC, abi: USDC_ABI, functionName: "balanceOf", args: [worker.address] })

  console.log(chalk.green("\n╔══ Result ══╗"))
  console.log("  Task Type:     " + task.type)
  console.log("  Orchestrator:  #" + orchestrator.agentId)
  console.log("  Worker:        #" + worker.agentId)
  console.log("  Evaluator:     #" + evaluator.agentId)
  console.log("  Job ID:        #" + jobId)
  console.log("  Status:        " + (evaluation.approved !== false ? "Completed ✓" : "Rejected ✗"))
  console.log("  Score:         " + evaluation.score + "/100")
  console.log("  Orchestrator:  " + formatUSDC(orchBal) + " → " + formatUSDC(orchBalAfter) + " USDC")
  console.log("  Worker:        " + formatUSDC(workBal) + " → " + formatUSDC(workBalAfter) + " USDC")
  console.log("  Explorer:      https://testnet.arcscan.app\n")
}

main().catch(e => { console.error(chalk.red("\n✗ Error: " + e.message + "\n")); process.exit(1) })
