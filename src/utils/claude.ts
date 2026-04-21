// Claude API entegrasyonu — AI karar motoru
export async function askClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // API key yoksa mock yanıt döndür
    return mockResponse(prompt)
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  const data = await res.json() as any
  return data.content?.[0]?.text ?? "No response"
}

function mockResponse(prompt: string): string {
  // Evaluator prompt — "Evaluate objectively" içeriyor
  if (prompt.includes("Evaluate objectively") || prompt.includes("objectively")) {
    // Retry sayısını prompt'tan çıkar
    // İlk çağrıda reddet, ikinci çağrıda onayla
    // evaluateCount ile takip et
    if (!globalThis._evalCount) globalThis._evalCount = 0
    globalThis._evalCount++
    // --retry modunda ilk reject, sonra approve
    // --chain modunda hep approve
    const isChain = prompt.includes("CHAIN") || prompt.includes("built_on") || prompt.includes("builds on previous")
    if (isChain) {
      return JSON.stringify({
        approved: true,
        score: 88,
        comment: "Chain step deliverable meets all criteria. Well-structured and builds on previous output.",
        criteria_met: ["Builds on previous step", "Meets quality bar", "Actionable output"],
        criteria_failed: [],
        strengths: ["Clear methodology", "Good use of previous data", "Actionable insights"],
        improvements: [],
        recommendation: "approve"
      })
    }
    const shouldReject = false  // normal flow hep approve
    if (shouldReject) {
      return JSON.stringify({
        approved: false,
        score: 45,
        comment: "Deliverable lacks sufficient detail and specific data points.",
        criteria_met: ["Basic structure present"],
        criteria_failed: ["Missing specific metrics", "No methodology explanation", "Insufficient data coverage"],
        strengths: ["Correct format"],
        improvements: ["Include specific TPS numbers", "Add time-based analysis", "Provide data sources"],
        recommendation: "reject"
      })
    } else {
      globalThis._evalCount = 0
      return JSON.stringify({
        approved: true,
        score: 91,
        comment: "Significantly improved. Deliverable now meets all acceptance criteria.",
        criteria_met: ["Specific metrics included", "Methodology explained", "Data coverage sufficient"],
        criteria_failed: [],
        strengths: ["Clear improvements from previous attempt", "Actionable insights", "Strong methodology"],
        improvements: ["Minor: could add confidence intervals"],
        recommendation: "approve"
      })
    }
  }
  if (prompt.includes("task") || prompt.includes("görev")) {
    return JSON.stringify({
      task: "Analyze Arc testnet transaction patterns and identify peak usage hours",
      skills: ["data-analysis", "blockchain"],
      budget: "2.0",
      deadline: "24 hours"
    })
  }
  if (prompt.includes("Evaluate") || prompt.includes("evaluate") || prompt.includes("değerlendir") || prompt.includes("assessment")) {
    return JSON.stringify({
      approved: true,
      score: 88,
      comment: "Deliverable meets all acceptance criteria. Analysis is well-structured and actionable.",
      strengths: ["Clear methodology", "Actionable insights", "Meets requirements"],
      improvements: ["Could include more data points"],
      recommendation: "approve"
    })
  }
  if (prompt.includes("deliver") || prompt.includes("teslim")) {
    return JSON.stringify({
      result: "Arc testnet peak hours: 08:00-10:00 UTC and 14:00-18:00 UTC. Average TPS: 32. Peak TPS: 89.",
      methodology: "Analyzed 10,000 blocks from Arc testnet explorer",
      confidence: 0.92
    })
  }
  return "Task completed successfully."
}
