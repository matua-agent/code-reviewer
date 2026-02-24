import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  const { code, language, issues } = await req.json();

  if (!code?.trim()) {
    return new Response(JSON.stringify({ error: "No code provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const issueList = Array.isArray(issues) && issues.length > 0
    ? issues
        .map(
          (iss, i) =>
            `${i + 1}. [${iss.severity.toUpperCase()}] ${iss.title}: ${iss.suggestion}`
        )
        .join("\n")
    : "Fix all identified issues";

  const systemPrompt = `You are an expert developer. Fix the provided code based on the review findings.
Return ONLY the corrected code, no explanation, no markdown fencing, just the fixed code.
Preserve the original structure and style where possible. Add comments to explain non-obvious fixes.`;

  const userMessage = `Fix this ${language || "code"} based on these review findings:

Issues to fix:
${issueList}

Original code:
${code}

Return only the corrected code:`;

  const stream = client.messages.stream({
    model: "claude-haiku-4-5",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`
              )
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: String(err) })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
