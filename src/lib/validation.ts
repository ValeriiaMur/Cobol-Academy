/**
 * Input Validation & Sanitization
 *
 * Validates and sanitizes all user inputs before they reach
 * the RAG pipeline, embedding APIs, or LLM prompts.
 */

import { validation } from "./config";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidatedSearchInput {
  query: string;
  topK: number;
  fusion: boolean;
}

/**
 * Sanitize a user query string:
 * - Trim whitespace
 * - Remove null bytes and control characters
 * - Collapse excessive whitespace
 * - Truncate to max length
 */
export function sanitizeQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";

  return raw
    // Remove null bytes
    .replace(/\0/g, "")
    // Remove control characters (except newline/tab)
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Trim
    .trim()
    // Collapse whitespace
    .replace(/\s+/g, " ")
    // Truncate
    .slice(0, validation.maxQueryLength);
}

/**
 * Validate a numeric parameter with bounds.
 */
function validateNumber(
  value: unknown,
  defaultValue: number,
  min: number,
  max: number
): number {
  if (value === undefined || value === null) return defaultValue;

  const num = typeof value === "number" ? value : Number(value);

  if (isNaN(num) || !isFinite(num)) return defaultValue;

  return Math.min(Math.max(Math.round(num), min), max);
}

/**
 * Validate a boolean parameter.
 */
function validateBoolean(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

/**
 * Validate and sanitize search/answer API input.
 * Returns either a validated input object or an array of errors.
 */
export function validateSearchInput(
  body: Record<string, unknown>
): { valid: true; data: ValidatedSearchInput } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  // Validate query
  const query = sanitizeQuery(body.query);

  if (!query) {
    errors.push({ field: "query", message: "Query string is required" });
  } else if (query.length < validation.minQueryLength) {
    errors.push({
      field: "query",
      message: `Query must be at least ${validation.minQueryLength} characters`,
    });
  } else if (query.length > validation.maxQueryLength) {
    errors.push({
      field: "query",
      message: `Query must not exceed ${validation.maxQueryLength} characters`,
    });
  }

  // Validate topK
  const topK = validateNumber(
    body.topK,
    validation.defaultTopK,
    validation.minTopK,
    validation.maxTopK
  );

  // Validate fusion
  const fusion = validateBoolean(body.fusion, false);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: { query, topK, fusion } };
}

/**
 * Sanitize text before including in LLM prompts to prevent prompt injection.
 * This is a defense-in-depth measure — the system prompt boundary is the
 * primary defense, but we still strip obvious injection patterns.
 */
export function sanitizeForPrompt(text: string): string {
  return text
    // Remove attempts to break out of user message context
    .replace(/\b(system|assistant)\s*:/gi, "")
    // Remove markdown-style role markers
    .replace(/^#{1,3}\s*(system|assistant)\b/gim, "")
    // Trim to reasonable length
    .slice(0, validation.maxQueryLength);
}
