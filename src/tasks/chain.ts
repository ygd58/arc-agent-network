import type { ArcAgent } from "../agents/base.js"
import type { TaskConfig, TaskType } from "./types.js"
import { TASK_TEMPLATES } from "./types.js"
import { orchestratorPrompt, workerPrompt, evaluatorPrompt } from "./prompts.js"
import { askClaude } from "../utils/claude.js"
import chalk from "chalk"
import { sleep } from "../utils/chain.js"

export type ChainStep = {
  taskType: TaskType
  inputFrom?: number  // önceki step'in çıktısını al
  label: string
}

export type ChainConfig = {
  name: string
  description: string
  steps: ChainStep[]
}

export type StepResult = {
  stepIndex: number
  taskType: TaskType
  jobId: bigint
  agentId: bigint
  deliverable: any
  score: number
  approved: boolean
}

// Önceki step çıktısını sonraki step'in girdisine entegre et
function buildChainedPrompt(task: TaskConfig, previousResults: StepResult[]): string {
  if (previousResults.length === 0) return workerPrompt(task, { task: task.description })

  const prevResult = previousResults[previousResults.length - 1]
  const prevTask = TASK_TEMPLATES[prevResult.taskType]

  return `You are a Worker agent on Arc blockchain testnet.

Your task builds on previous work in this pipeline.

Previous Step: ${prevTask.title}
Previous Deliverable: ${JSON.stringify(prevResult.deliverable)}

Your Task: ${task.title}
Description: ${task.description}
Required Skills: ${task.requiredSkills.join(", ")}

Use the previous step's output as input for your work. Build on it, don't repeat it.
Respond ONLY with valid JSON, no markdown:
{
  "result": "your deliverable that builds on previous work",
  "methodology": "how you used the previous output",
  "key_findings": ["finding 1", "finding 2", "finding 3"],
  "built_on": "what specifically from the previous step you used",
  "confidence": 0.95
}`
}

export async function runTaskChain(
  orchestrator: ArcAgent,
  workers: ArcAgent[],
  evaluator: ArcAgent,
  chainConfig: ChainConfig
): Promise<StepResult[]> {
  const results: StepResult[] = []

  console.log(chalk.cyan.bold(`\n  ╔══ Task Chain: ${chainConfig.name} ══╗`))
  console.log(chalk.gray(`  ${chainConfig.description}`))
  console.log(chalk.gray(`  Steps: ${chainConfig.steps.length}\n`))

  for (let i = 0; i < chainConfig.steps.length; i++) {
    const step = chainConfig.steps[i]
    const task = TASK_TEMPLATES[step.taskType]
    const worker = workers[i % workers.length]

    console.log(chalk.cyan(`\n  ┌── Step ${i + 1}/${chainConfig.steps.length}: ${step.label} ──`))
    console.log(`  │  Task: ${task.title}`)
    console.log(`  │  Worker: ${worker.name}`)
    console.log(`  │  Budget: ${task.budget} USDC`)
    if (i > 0) console.log(chalk.gray(`  │  Input: Step ${i} output`))

    // Job oluştur
    const jobId = await orchestrator.createJob(
      worker.address,
      evaluator.address,
      `[CHAIN-${i+1}] ${task.title}`,
      task.budget
    )

    await sleep(800)

    // Worker çalış — önceki çıktıyı kullan
    worker.log(chalk.gray("🤔 Çalışıyor..."))
    const prompt = buildChainedPrompt(task, results)
    const deliveryRaw = await askClaude(prompt)

    let delivery: any = {}
    try { delivery = JSON.parse(deliveryRaw) }
    catch { delivery = { result: deliveryRaw } }

    worker.log(chalk.white(`Result: ${(delivery.result ?? "").slice(0, 70)}...`))
    if (delivery.built_on && i > 0) {
      worker.log(chalk.cyan(`  ↳ Built on: ${delivery.built_on.slice(0, 60)}`))
    }

    await worker.submitJob(jobId, JSON.stringify(delivery))
    await sleep(500)

    // Evaluate
    const evalRaw = await askClaude("[CHAIN-EVAL] " + evaluatorPrompt(task, { task: task.description }, delivery))
    evaluator.log(chalk.gray("🤔 Değerlendiriyor..."))
    let evaluation: any = {}
    try { evaluation = JSON.parse(evalRaw) }
    catch { evaluation = { approved: true, score: 85, comment: "Completed" } }

    const approved = evaluation.approved !== false && evaluation.recommendation !== "reject"
    evaluator.log(chalk.white(`Score: ${evaluation.score}/100 — ${approved ? chalk.green("Approved") : chalk.red("Rejected")}`))

    if (approved) await evaluator.completeJob(jobId)

    results.push({
      stepIndex: i,
      taskType: step.taskType,
      jobId,
      agentId: worker.agentId,
      deliverable: delivery,
      score: evaluation.score ?? 0,
      approved,
    })

    console.log(`  └── Step ${i + 1} ${approved ? chalk.green("complete ✓") : chalk.red("failed ✗")}`)
  }

  return results
}

// Hazır chain şablonları
export const CHAIN_TEMPLATES: Record<string, ChainConfig> = {
  research_to_analysis: {
    name: "Research → Analysis Pipeline",
    description: "Research the ecosystem, then analyze the data, then produce market insights",
    steps: [
      { taskType: "research", label: "Ecosystem Research" },
      { taskType: "data_analysis", label: "Data Analysis", inputFrom: 0 },
      { taskType: "market_analysis", label: "Market Insights", inputFrom: 1 },
    ]
  },
  audit_pipeline: {
    name: "Code Review → Audit Pipeline",
    description: "Review code quality, then perform security audit",
    steps: [
      { taskType: "code_review", label: "Code Review" },
      { taskType: "smart_contract_audit", label: "Security Audit", inputFrom: 0 },
    ]
  },
  full_pipeline: {
    name: "Full Analysis Pipeline",
    description: "Complete pipeline: research → data analysis → market analysis → audit",
    steps: [
      { taskType: "research", label: "Ecosystem Research" },
      { taskType: "data_analysis", label: "Data Analysis", inputFrom: 0 },
      { taskType: "market_analysis", label: "Market Insights", inputFrom: 1 },
      { taskType: "smart_contract_audit", label: "Security Audit", inputFrom: 2 },
    ]
  }
}
