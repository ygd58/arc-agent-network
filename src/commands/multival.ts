import type { ArcAgent } from "../agents/base.js"
import { askClaude } from "../utils/claude.js"
import type { TaskConfig } from "../tasks/types.js"
import { evaluatorPrompt } from "../tasks/prompts.js"
import chalk from "chalk"

export type EvaluatorVote = {
  evaluator: ArcAgent
  score: number
  approved: boolean
  comment: string
  weight: number
}

export type MultiEvalResult = {
  finalScore: number
  approved: boolean
  votes: EvaluatorVote[]
  consensus: "unanimous" | "majority" | "split"
  comment: string
}

export async function runMultiEval(
  evaluators: ArcAgent[],
  task: TaskConfig,
  assignment: any,
  delivery: any,
  weights?: number[]
): Promise<MultiEvalResult> {
  console.log(chalk.cyan(`\n  ── Multi-Evaluator Vote (${evaluators.length} evaluators) ──`))

  const votes: EvaluatorVote[] = []
  const evalWeights = weights ?? evaluators.map(() => 1)

  for (let i = 0; i < evaluators.length; i++) {
    const evaluator = evaluators[i]
    const weight = evalWeights[i]

    evaluator.log(chalk.gray(`🗳️  Oyluyor... (weight: ${weight}x)`))

    const raw = await askClaude(evaluatorPrompt(task, assignment, delivery))
    let vote: any = {}
    try { vote = JSON.parse(raw) }
    catch { vote = { approved: true, score: 80, comment: "Completed" } }

    const approved = vote.approved !== false && vote.recommendation !== "reject"
    const score = vote.score ?? 80

    evaluator.log(chalk.white(`  Vote: ${approved ? chalk.green("APPROVE") : chalk.red("REJECT")} — ${score}/100`))
    evaluator.log(chalk.gray(`  "${(vote.comment ?? "").slice(0, 60)}"`))

    votes.push({ evaluator, score, approved, comment: vote.comment ?? "", weight })
  }

  // Ağırlıklı ortalama hesapla
  const totalWeight = evalWeights.reduce((a, b) => a + b, 0)
  const weightedScore = votes.reduce((sum, v) => sum + v.score * v.weight, 0) / totalWeight
  const approveVotes = votes.filter(v => v.approved)
  const approveWeight = approveVotes.reduce((sum, v) => sum + v.weight, 0)
  const approved = approveWeight > totalWeight / 2

  // Konsensus tipi
  const allSame = votes.every(v => v.approved === votes[0].approved)
  const consensus = allSame ? "unanimous"
    : approveWeight > totalWeight * 0.66 ? "majority" : "split"

  const consensusColor = consensus === "unanimous" ? chalk.green
    : consensus === "majority" ? chalk.yellow : chalk.red

  console.log(chalk.cyan(`\n  ── Voting Result ──────────────────`))
  console.log(`  ${"Votes".padEnd(20)} ${approveVotes.length}/${votes.length} approve`)
  console.log(`  ${"Weighted Score".padEnd(20)} ${weightedScore.toFixed(1)}/100`)
  console.log(`  ${"Consensus".padEnd(20)} ${consensusColor(consensus)}`)
  console.log(`  ${"Final Decision".padEnd(20)} ${approved ? chalk.green("APPROVED ✓") : chalk.red("REJECTED ✗")}`)

  // Vote breakdown
  console.log(chalk.gray("\n  Individual votes:"))
  votes.forEach(v => {
    const icon = v.approved ? chalk.green("✓") : chalk.red("✗")
    console.log(chalk.gray(`    ${icon} ${v.evaluator.name.padEnd(15)} ${v.score}/100 (weight: ${v.weight}x)`))
  })

  return {
    finalScore: Math.round(weightedScore),
    approved,
    votes,
    consensus,
    comment: `${consensus} ${approved ? "approval" : "rejection"} — weighted score: ${weightedScore.toFixed(1)}/100`
  }
}
