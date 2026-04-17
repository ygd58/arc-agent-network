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
    return JSON.stringify({
      approved: true,
      score: 88,
      comment: "Deliverable meets all acceptance criteria. Well-structured and actionable.",
      strengths: ["Clear methodology", "Actionable insights", "Meets requirements"],
      improvements: ["Could include more data points"],
      recommendation: "approve"
    })
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
