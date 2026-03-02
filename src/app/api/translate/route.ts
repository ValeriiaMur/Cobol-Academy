/**
 * API Route: /api/translate
 *
 * Translates COBOL code to a modern language equivalent.
 * Returns a streaming SSE response with the translation.
 */

import { NextRequest } from "next/server";
import OpenAI from "openai";

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

const TRANSLATE_PROMPT = `You are COBOL Academy's code translator. Convert the given COBOL code to the target language, preserving the business logic and structure.

Rules:
1. Write idiomatic code in the target language (not a literal line-by-line translation)
2. Add brief comments explaining what each section does
3. Map COBOL concepts to modern equivalents:
   - WORKING-STORAGE → class fields / module variables
   - PERFORM → function calls
   - MOVE → variable assignment
   - PIC/PICTURE → type annotations
   - COPY → import statements
   - FD/SELECT → file/database access
   - 88-level items → enums or boolean constants
4. After the code, add a brief "Key Differences" section noting important semantic differences
5. Keep the translation concise and educational`;

export async function POST(request: NextRequest) {
  try {
    const { cobolCode, targetLang, filePath, paragraphName, division } = await request.json();

    if (!cobolCode || !targetLang) {
      return new Response(JSON.stringify({ error: "Missing cobolCode or targetLang" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const openai = getOpenAI();

    const stream = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: TRANSLATE_PROMPT },
        {
          role: "user",
          content: `Translate this COBOL code to ${targetLang}:

File: ${filePath}
${division ? `Division: ${division}` : ""}
${paragraphName ? `Paragraph: ${paragraphName}` : ""}

\`\`\`cobol
${cobolCode}
\`\`\`

Provide the ${targetLang} equivalent with comments, then a brief "Key Differences" section.`,
        },
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 2000,
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Translation failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const runtime = "nodejs";
export const maxDuration = 30;
