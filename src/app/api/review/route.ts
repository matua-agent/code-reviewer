import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ReviewResult } from "@/lib/types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM = `You are an expert code reviewer with deep knowledge of software engineering best practices, security vulnerabilities, and performance optimization.

You will analyze code and return a JSON review. Be thorough but constructive.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "summary": "2-3 sentence overview of the code quality",
  "score": <integer 0-100>,
  "language": "<detected language>",
  "positives": ["thing1", "thing2"],
  "issues": [
    {
      "category": "<one of: bugs|security|performance|logic|style|documentation>",
      "severity": "<one of: critical|major|minor|info>",
      "title": "Short title",
      "description": "Clear explanation of the problem",
      "line": <line number or null>,
      "suggestion": "Specific fix or improvement"
    }
  ]
}

Scoring guide:
- 90-100: Excellent, production-ready
- 70-89: Good with minor issues
- 50-69: Needs improvement  
- 30-49: Significant issues
- 0-29: Major problems

Be specific. Reference actual line numbers when possible. Suggest concrete fixes.`;

export async function POST(req: NextRequest) {
  const { code, language } = await req.json();

  if (!code?.trim()) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  const userMessage = language
    ? `Review this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\``
    : `Review this code:\n\`\`\`\n${code}\n\`\`\``;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText =
      msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

    // Parse JSON (handle potential markdown wrapping)
    let jsonStr = rawText;
    const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) jsonStr = fenced[1].trim();

    const review = JSON.parse(jsonStr) as ReviewResult;
    return NextResponse.json(review);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Review failed", detail: String(err) },
      { status: 500 }
    );
  }
}
