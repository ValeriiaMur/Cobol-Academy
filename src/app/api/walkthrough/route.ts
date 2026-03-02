/**
 * API Route: /api/walkthrough
 *
 * Generates line-by-line annotations for COBOL code.
 * Returns structured JSON with categorized explanations per line.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

const WALKTHROUGH_PROMPT = `You are COBOL Academy's code analysis engine. Analyze the given COBOL code and produce line-by-line annotations.

For each significant line (skip blank lines and purely decorative comment separator lines like "****"), produce a JSON object with:
- "line": the line number (use the provided starting line number)
- "explanation": a clear, educational 1-2 sentence explanation of what this line does
- "category": one of: "structure" (DIVISION/SECTION/PROGRAM-ID), "data" (variable definitions, PIC, VALUE), "logic" (MOVE, COMPUTE, ADD, arithmetic), "io" (DISPLAY, ACCEPT, READ, WRITE, OPEN, CLOSE), "control" (PERFORM, IF, EVALUATE, GO TO, EXIT), "comment" (meaningful comments worth explaining), "other"

Guidelines:
- Explain what the line does in plain English, as if teaching a modern developer
- For PIC clauses, explain the data format (e.g., "PIC 9(4) means a 4-digit numeric field")
- For PERFORM, explain what paragraph is being called and why
- For MOVE, explain the data flow
- For 88-level items, explain they are condition names (like boolean flags)
- For COPY statements, explain they include external copybook definitions
- Group consecutive similar lines (e.g., multiple variable declarations) — annotate the first and skip the rest
- Return ONLY a valid JSON array, no markdown fences or explanation text

Return format: [{"line": 101, "explanation": "...", "category": "structure"}, ...]`;

export async function POST(request: NextRequest) {
  try {
    const { cobolCode, filePath, paragraphName, division, lineStart } = await request.json();

    if (!cobolCode) {
      return NextResponse.json({ error: "Missing cobolCode" }, { status: 400 });
    }

    const openai = getOpenAI();

    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: WALKTHROUGH_PROMPT },
        {
          role: "user",
          content: `Analyze this COBOL code (starting at line ${lineStart}):

File: ${filePath}
${division ? `Division: ${division}` : ""}
${paragraphName ? `Paragraph: ${paragraphName}` : ""}

\`\`\`
${cobolCode}
\`\`\`

Return a JSON array of annotations. Line numbers start at ${lineStart}.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    let annotations;

    try {
      const parsed = JSON.parse(content);
      // Handle both {annotations: [...]} and direct array
      annotations = Array.isArray(parsed) ? parsed : parsed.annotations || [];
    } catch {
      annotations = [];
    }

    return NextResponse.json({ annotations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Walkthrough failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const maxDuration = 30;
