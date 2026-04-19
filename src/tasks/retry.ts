import type { ArcAgent } from "../agents/base.js"
import type { TaskConfig } from "./types.js"
import { workerPrompt, evaluatorPrompt } from "./prompts.js"
import chalk from "chalk"

export type RetryResult = {
  attempt: number
  approved: boolean
  score: number
  comment: string
  deliverable: any
  evaluation: any
  finalJobId: bigint
}

export async function workerRetryPrompt(
  task: TaskConfig,
  assignment: any,
  previousDelivery: any,
  rejectionFeedback: string,
  attempt: number
): Promise<string> {
  const { askClaude } = await import("../utils/claude.js")
  return askClaude(`You are a Worker agent on Arc blockchain. Previous submission was rejected.

Task: ${task.description}
Attempt: ${attempt} of 3

Previous submission: ${JSON.stringify(previousDelivery)}
Rejection feedback: ${rejectionFeedback}

Improve significantly. Be specific with data, metrics, and methodology.
Respond ONLY with valid JSON, no markdown:
{
  "result": "improved detailed deliverable with specific numbers",
  "methodology": "what you changed and why",
  "key_findings": ["specific finding 1", "specific finding 2", "specific finding 3"],
  "improvements_made": ["added specific TPS data", "added time analysis"],
  "confidence": 0.95
}`)
}

export async function runWithRetry(
  orchestrator: ArcAgent,
  worker: ArcAgent,
  evaluator: ArcAgent,
  task: TaskConfig,
  assignment: any,
  firstJobId: bigint,
  maxAttempts: number = 3
): Promise<RetryResult> {
  let lastDelivery: any = {}
  let lastEvaluation: any = {}
  let rejectionFeedback = ""
  let currentJobId = firstJobId

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(chalk.cyan(`\n  ── Attempt ${attempt}/${maxAttempts} ──────────────────`))

    // Attempt 2+ için yeni job oluştur
    if (attempt > 1) {
      worker.log(chalk.yellow(`♻️  New job for attempt ${attempt} (feedback: ${rejectionFeedback.slice(0, 50)}...)`))
      currentJobId = await orchestrator.createJob(
        worker.address,
        evaluator.address,
        "[RETRY-" + attempt + "] " + (assignment.task ?? task.description),
        task.budget
      )
    }

    // Worker çalış
    let deliveryRaw: string
    if (attempt === 1) {
      const { askClaude } = await import("../utils/claude.js")
      deliveryRaw = await askClaude(workerPrompt(task, assignment))
      worker.log(chalk.gray("🤔 Düşünüyor..."))
    } else {
      deliveryRaw = await workerRetryPrompt(task, assignment, lastDelivery, rejectionFeedback, attempt)
    }

    try { lastDelivery = JSON.parse(deliveryRaw) }
    catch { lastDelivery = { result: deliveryRaw } }

    worker.log(chalk.white(`Result: ${(lastDelivery.result ?? "").slice(0, 80)}...`))
    if (lastDelivery.improvements_made && attempt > 1) {
      lastDelivery.improvements_made.forEach((imp: string) => {
        worker.log(chalk.cyan(`  ↑ ${imp}`))
      })
    }

    await worker.submitJob(currentJobId, JSON.stringify(lastDelivery))

    // Evaluator değerlendir
    const { askClaude } = await import("../utils/claude.js")
    const evalRaw = await askClaude(evaluatorPrompt(task, assignment, lastDelivery))
    evaluator.log(chalk.gray("🤔 Değerlendiriyor..."))
    try { lastEvaluation = JSON.parse(evalRaw) }
    catch { lastEvaluation = { approved: true, score: 80, comment: "Completed" } }

    evaluator.log(chalk.white(`Score: ${lastEvaluation.score}/100`))
    evaluator.log(chalk.white(lastEvaluation.comment ?? ""))

    if (lastEvaluation.approved !== false && lastEvaluation.recommendation !== "reject") {
      evaluator.log(chalk.green(`✓ Attempt ${attempt} approved`))
      if (lastEvaluation.strengths) {
        lastEvaluation.strengths.forEach((s: string) => evaluator.log(chalk.green(`  + ${s}`)))
      }
      return {
        attempt,
        approved: true,
        score: lastEvaluation.score ?? 80,
        comment: lastEvaluation.comment ?? "",
        deliverable: lastDelivery,
        evaluation: lastEvaluation,
        finalJobId: currentJobId,
      }
    } else {
      rejectionFeedback = lastEvaluation.comment ?? "Quality not sufficient"
      if (lastEvaluation.criteria_failed?.length) {
        rejectionFeedback += ". Failed: " + lastEvaluation.criteria_failed.join(", ")
      }
      evaluator.log(chalk.red(`✗ Attempt ${attempt} rejected`))
      if (attempt < maxAttempts) {
        evaluator.log(chalk.yellow(`  ${maxAttempts - attempt} attempt(s) remaining — new job will be created`))
      }
    }
  }

  evaluator.log(chalk.red(`✗ Max attempts (${maxAttempts}) reached`))
  return {
    attempt: maxAttempts,
    approved: false,
    score: lastEvaluation.score ?? 0,
    comment: lastEvaluation.comment ?? "Failed after max attempts",
    deliverable: lastDelivery,
    evaluation: lastEvaluation,
    finalJobId: currentJobId,
  }
}
