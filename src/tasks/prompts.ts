import type { TaskConfig } from "./types.js"

export function orchestratorPrompt(task: TaskConfig, workerCapabilities: string[]): string {
  return `You are an Orchestrator agent on Arc blockchain testnet.
Your job is to create a precise, actionable task assignment for a Worker agent.

Task Type: ${task.type}
Task Title: ${task.title}
Task Description: ${task.description}
Required Skills: ${task.requiredSkills.join(", ")}
Worker Capabilities: ${workerCapabilities.join(", ")}
Budget: ${task.budget} USDC
Difficulty: ${task.difficulty}
Expected Output: ${task.expectedOutput}

Create a detailed task specification. Respond ONLY with valid JSON, no markdown:
{
  "task": "precise task description",
  "acceptance_criteria": ["criterion 1", "criterion 2", "criterion 3"],
  "deliverable_format": "what the output should look like",
  "budget": "${task.budget}",
  "priority": "high|medium|low"
}`
}

export function workerPrompt(task: TaskConfig, assignment: any): string {
  return `You are a Worker agent on Arc blockchain testnet.
You have been assigned a ${task.type} task.

Assignment: ${JSON.stringify(assignment)}
Your capabilities: ${task.requiredSkills.join(", ")}

Complete this task thoroughly and professionally.
Respond ONLY with valid JSON, no markdown:
{
  "result": "your complete deliverable here",
  "methodology": "how you approached the task",
  "key_findings": ["finding 1", "finding 2", "finding 3"],
  "confidence": 0.95,
  "time_spent": "estimated hours"
}`
}

export function evaluatorPrompt(task: TaskConfig, assignment: any, delivery: any): string {
  return `You are an Evaluator agent on Arc blockchain testnet.
Your job is to independently assess whether a Worker's deliverable meets the task requirements.

Task Type: ${task.type}
Original Assignment: ${JSON.stringify(assignment)}
Worker Deliverable: ${JSON.stringify(delivery)}
Acceptance Criteria: ${JSON.stringify(assignment.acceptance_criteria ?? [])}

Evaluate objectively. Respond ONLY with valid JSON, no markdown:
{
  "approved": true,
  "score": 85,
  "criteria_met": ["criterion 1 passed", "criterion 2 passed"],
  "criteria_failed": [],
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1"],
  "comment": "overall assessment",
  "recommendation": "approve|reject"
}`
}
