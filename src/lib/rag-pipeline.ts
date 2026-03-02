/**
 * RAG Pipeline - Core retrieval and answer generation
 *
 * Flow: Query → Embed → Search Pinecone → Assemble Context → LLM Answer
 */

import OpenAI from "openai";
import { generateQueryEmbedding } from "./embeddings";
import { queryVectors, VectorMetadata } from "./pinecone";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const LLM_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  division: string;
  section: string;
  paragraphName: string;
  chunkType: string;
  dependencies: string[];
}

export interface AnswerResponse {
  answer: string;
  sources: SearchResult[];
  query: string;
  latencyMs: number;
}

/**
 * Search the COBOL codebase for relevant chunks.
 */
export async function searchCodebase(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  const queryEmbedding = await generateQueryEmbedding(query);
  const matches = await queryVectors(queryEmbedding, topK);

  return matches.map((match) => {
    const meta = (match.metadata || {}) as unknown as VectorMetadata;
    return {
      id: match.id,
      score: match.score || 0,
      content: meta.content || "",
      filePath: meta.filePath || "",
      lineStart: meta.lineStart || 0,
      lineEnd: meta.lineEnd || 0,
      division: meta.division || "",
      section: meta.section || "",
      paragraphName: meta.paragraphName || "",
      chunkType: meta.chunkType || "",
      dependencies: meta.dependencies ? meta.dependencies.split(",").filter(Boolean) : [],
    };
  });
}

/**
 * Build context string from search results for LLM.
 */
function assembleContext(results: SearchResult[]): string {
  return results
    .map(
      (r, i) =>
        `--- Source ${i + 1} ---
File: ${r.filePath} (Lines ${r.lineStart}-${r.lineEnd})
${r.division}${r.section ? ` > ${r.section}` : ""}${r.paragraphName ? ` > ${r.paragraphName}` : ""}
${r.dependencies.length > 0 ? `Dependencies: ${r.dependencies.join(", ")}` : ""}

${r.content}
`
    )
    .join("\n");
}

const SYSTEM_PROMPT = `You are COBOL Academy's AI teaching assistant — an expert in COBOL programming that helps developers understand legacy code. You have deep knowledge of COBOL syntax, conventions, and enterprise patterns.

Your role:
1. **Code Explanation**: Explain COBOL code in plain English, making it accessible to developers who know modern languages but not COBOL
2. **Translation Hints**: When relevant, suggest modern language equivalents (Python, JavaScript, etc.)
3. **Pattern Detection**: Identify common COBOL patterns (file I/O, record processing, error handling)
4. **Business Logic Extraction**: Highlight the business rules embedded in the code

Guidelines:
- Always cite specific file paths and line numbers from the retrieved context
- Explain COBOL-specific concepts (divisions, sections, paragraphs, copybooks, etc.)
- Use analogies to modern programming concepts where helpful
- If the retrieved code doesn't fully answer the question, say so honestly
- Format code references with backticks and be specific about locations
- Keep explanations clear and educational — you're teaching, not just answering

Remember: You are powered by real COBOL source code from the GnuCOBOL compiler. Your answers should reference actual code, not generic COBOL knowledge.`;

/**
 * Generate an answer using retrieved context and streaming.
 * Returns a ReadableStream for SSE.
 */
export async function generateStreamingAnswer(
  query: string,
  results: SearchResult[]
): Promise<ReadableStream> {
  const openai = getOpenAI();
  const context = assembleContext(results);

  const stream = await openai.chat.completions.create({
    model: LLM_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Based on the following COBOL source code from the GnuCOBOL project, answer this question:

Question: ${query}

Retrieved Code Context:
${context}

Provide a clear, educational answer that references specific files and line numbers. If the context doesn't contain enough information, say so.`,
      },
    ],
    stream: true,
    temperature: 0.3,
    max_tokens: 2000,
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
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
}

/**
 * Generate a non-streaming answer (for simpler use cases).
 */
export async function generateAnswer(
  query: string,
  results: SearchResult[]
): Promise<string> {
  const openai = getOpenAI();
  const context = assembleContext(results);

  const response = await openai.chat.completions.create({
    model: LLM_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Based on the following COBOL source code from the GnuCOBOL project, answer this question:

Question: ${query}

Retrieved Code Context:
${context}

Provide a clear, educational answer that references specific files and line numbers.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  return response.choices[0]?.message?.content || "Unable to generate answer.";
}
