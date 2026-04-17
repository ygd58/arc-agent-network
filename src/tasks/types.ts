export type TaskType = 
  | "data_analysis"
  | "code_review" 
  | "research"
  | "smart_contract_audit"
  | "market_analysis"

export type TaskConfig = {
  type: TaskType
  title: string
  description: string
  requiredSkills: string[]
  budget: string
  difficulty: "easy" | "medium" | "hard"
  expectedOutput: string
}

export const TASK_TEMPLATES: Record<TaskType, TaskConfig> = {
  data_analysis: {
    type: "data_analysis",
    title: "Arc Testnet Data Analysis",
    description: "Analyze Arc testnet transaction patterns, identify peak usage hours, calculate average TPS, and provide actionable insights",
    requiredSkills: ["data-analysis", "blockchain", "statistics"],
    budget: "1.0",
    difficulty: "medium",
    expectedOutput: "Statistical report with peak hours, TPS metrics, and usage patterns"
  },
  code_review: {
    type: "code_review",
    title: "Smart Contract Code Review",
    description: "Review a Solidity smart contract for security vulnerabilities, gas optimization opportunities, and best practice violations",
    requiredSkills: ["solidity", "security", "evm"],
    budget: "2.0",
    difficulty: "hard",
    expectedOutput: "Detailed review with severity ratings, specific line references, and fix recommendations"
  },
  research: {
    type: "research",
    title: "Arc Ecosystem Research",
    description: "Research and summarize the current state of Arc ecosystem — active projects, developer activity, key metrics, and growth trends",
    requiredSkills: ["research", "blockchain", "writing"],
    budget: "1.5",
    difficulty: "easy",
    expectedOutput: "Structured report covering ecosystem overview, key projects, and growth metrics"
  },
  smart_contract_audit: {
    type: "smart_contract_audit",
    title: "ERC-8183 Contract Audit",
    description: "Audit the AgenticCommerce ERC-8183 reference implementation for potential vulnerabilities, edge cases, and compliance with the standard",
    requiredSkills: ["solidity", "auditing", "erc-8183", "security"],
    budget: "3.0",
    difficulty: "hard",
    expectedOutput: "Audit report with findings categorized by severity, proof of concept for any vulnerabilities, and remediation steps"
  },
  market_analysis: {
    type: "market_analysis",
    title: "USDC Flow Analysis on Arc",
    description: "Analyze USDC flow patterns on Arc testnet — top senders, receivers, average transaction size, and liquidity distribution",
    requiredSkills: ["data-analysis", "defi", "blockchain"],
    budget: "1.5",
    difficulty: "medium",
    expectedOutput: "Market analysis report with flow charts, top addresses, and liquidity insights"
  }
}
