/**
 * COBOL-Aware Syntax Chunker
 *
 * Splits COBOL source files using paragraph-level boundaries,
 * which are the natural semantic units in COBOL code.
 * Falls back to fixed-size chunking for non-procedural divisions.
 *
 * Enhancements:
 * - Comment extraction: preserves inline comments as context
 * - Encoding normalization: handles non-ASCII and legacy encodings
 * - Copybook awareness: detects COPY statements for dependency graph
 * - Improved paragraph detection with continuation line handling
 */

export interface CobolChunk {
  content: string;
  metadata: {
    filePath: string;
    lineStart: number;
    lineEnd: number;
    division: string;
    section: string;
    paragraphName: string;
    chunkType: "paragraph" | "division" | "fixed";
    dependencies: string[]; // PERFORM targets, COPY statements, CALL targets
    commentSummary: string; // Extracted comments for this chunk
    linesOfCode: number;    // Non-blank, non-comment lines
    complexity: number;     // Simple heuristic: conditionals + performs
  };
}

// COBOL division patterns
const DIVISION_PATTERN = /^[\s]*(\w[\w-]*)\s+DIVISION\b/i;
const SECTION_PATTERN = /^[\s]*(\w[\w-]*)\s+SECTION\b/i;
const PARAGRAPH_PATTERN = /^[\s]{0,6}(\w[\w-]*)\.\s*$/;

// Fixed-size chunking params for non-procedure code
const FIXED_CHUNK_SIZE = 40; // lines
const FIXED_CHUNK_OVERLAP = 5; // lines

/**
 * Normalize encoding issues common in legacy COBOL files
 */
function normalizeEncoding(source: string): string {
  return source
    // Replace common non-ASCII quotes/dashes
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "--")
    // Remove BOM
    .replace(/^\uFEFF/, "")
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove trailing whitespace per line
    .replace(/[ \t]+$/gm, "")
    // Replace tabs with spaces (COBOL uses fixed columns)
    .replace(/\t/g, "    ");
}

/**
 * Check if a line is a COBOL comment (column 7 = * or /)
 */
function isCommentLine(line: string): boolean {
  if (line.length <= 6) return false;
  const col7 = line[6];
  return col7 === "*" || col7 === "/";
}

/**
 * Check if a line is a continuation line (column 7 = -)
 */
function isContinuationLine(line: string): boolean {
  if (line.length <= 6) return false;
  return line[6] === "-";
}

/**
 * Extract comment text from a comment line (strip the * prefix and leading whitespace)
 */
function extractCommentText(line: string): string {
  if (line.length <= 7) return "";
  return line.substring(7).trim();
}

/**
 * Extract all dependencies (PERFORM, COPY, CALL) from code
 */
function extractDependencies(code: string): string[] {
  const deps: string[] = [];
  let match;

  const performRegex = /\bPERFORM\s+([\w-]+)/gi;
  while ((match = performRegex.exec(code)) !== null) {
    deps.push(`PERFORM:${match[1]}`);
  }

  const copyRegex = /\bCOPY\s+([\w-]+)/gi;
  while ((match = copyRegex.exec(code)) !== null) {
    deps.push(`COPY:${match[1]}`);
  }

  const callRegex = /\bCALL\s+['"]?([\w-]+)/gi;
  while ((match = callRegex.exec(code)) !== null) {
    deps.push(`CALL:${match[1]}`);
  }

  return [...new Set(deps)];
}

/**
 * Calculate a simple complexity score for a code chunk
 */
function calculateComplexity(code: string): number {
  const upperCode = code.toUpperCase();
  let complexity = 0;

  // Count conditionals
  complexity += (upperCode.match(/\bIF\b/g) || []).length;
  complexity += (upperCode.match(/\bEVALUATE\b/g) || []).length;
  complexity += (upperCode.match(/\bWHEN\b/g) || []).length;

  // Count PERFORM statements (control flow)
  complexity += (upperCode.match(/\bPERFORM\b/g) || []).length;

  // Count error handling
  complexity += (upperCode.match(/\bON\s+ERROR\b/g) || []).length;
  complexity += (upperCode.match(/\bINVALID\s+KEY\b/g) || []).length;
  complexity += (upperCode.match(/\bAT\s+END\b/g) || []).length;

  // Count I/O operations
  complexity += (upperCode.match(/\bREAD\b/g) || []).length;
  complexity += (upperCode.match(/\bWRITE\b/g) || []).length;

  return complexity;
}

/**
 * Count lines of code (non-blank, non-comment)
 */
function countLOC(lines: string[]): number {
  return lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return false;
    if (isCommentLine(line)) return false;
    return true;
  }).length;
}

/**
 * Extract comments from a set of lines, returning a summary string
 */
function extractComments(lines: string[]): string {
  const comments: string[] = [];
  for (const line of lines) {
    if (isCommentLine(line)) {
      const text = extractCommentText(line);
      if (text && !text.match(/^[*=-]+$/)) {
        // Skip decorative comment lines (*****, =====, etc.)
        comments.push(text);
      }
    }
  }
  // Limit to first 500 chars to keep metadata manageable
  const summary = comments.join(" ").substring(0, 500);
  return summary;
}

function fixedSizeChunk(
  lines: string[],
  startLine: number,
  filePath: string,
  division: string,
  section: string
): CobolChunk[] {
  const chunks: CobolChunk[] = [];

  for (let i = 0; i < lines.length; i += FIXED_CHUNK_SIZE - FIXED_CHUNK_OVERLAP) {
    const chunkLines = lines.slice(i, i + FIXED_CHUNK_SIZE);
    if (chunkLines.length === 0) break;

    const content = chunkLines.join("\n");
    const deps = extractDependencies(content);

    chunks.push({
      content,
      metadata: {
        filePath,
        lineStart: startLine + i + 1,
        lineEnd: startLine + i + chunkLines.length,
        division,
        section,
        paragraphName: "",
        chunkType: "fixed",
        dependencies: deps,
        commentSummary: extractComments(chunkLines),
        linesOfCode: countLOC(chunkLines),
        complexity: calculateComplexity(content),
      },
    });
  }

  return chunks;
}

export function chunkCobolFile(source: string, filePath: string): CobolChunk[] {
  // Normalize encoding before processing
  const normalizedSource = normalizeEncoding(source);
  const lines = normalizedSource.split("\n");
  const chunks: CobolChunk[] = [];

  let currentDivision = "UNKNOWN";
  let currentSection = "";
  let currentParagraph = "";
  let paragraphLines: string[] = [];
  let paragraphStartLine = 0;
  let inProcedureDivision = false;

  // Accumulate non-procedure lines for fixed chunking
  let nonProcLines: string[] = [];
  let nonProcStart = 0;
  let nonProcDivision = "";
  let nonProcSection = "";

  function flushParagraph() {
    if (paragraphLines.length > 0 && currentParagraph) {
      const content = paragraphLines.join("\n");
      chunks.push({
        content,
        metadata: {
          filePath,
          lineStart: paragraphStartLine,
          lineEnd: paragraphStartLine + paragraphLines.length - 1,
          division: currentDivision,
          section: currentSection,
          paragraphName: currentParagraph,
          chunkType: "paragraph",
          dependencies: extractDependencies(content),
          commentSummary: extractComments(paragraphLines),
          linesOfCode: countLOC(paragraphLines),
          complexity: calculateComplexity(content),
        },
      });
      paragraphLines = [];
    }
  }

  function flushNonProc() {
    if (nonProcLines.length > 0) {
      const fixedChunks = fixedSizeChunk(
        nonProcLines,
        nonProcStart,
        filePath,
        nonProcDivision,
        nonProcSection
      );
      chunks.push(...fixedChunks);
      nonProcLines = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Keep comment lines in the chunk content for context,
    // but skip them for structural parsing
    if (isCommentLine(line)) {
      if (inProcedureDivision && currentParagraph) {
        paragraphLines.push(line);
      } else {
        nonProcLines.push(line);
        if (nonProcLines.length === 1) {
          nonProcStart = lineNum;
          nonProcDivision = currentDivision;
          nonProcSection = currentSection;
        }
      }
      continue;
    }

    // Skip continuation lines for structural parsing but include in content
    if (isContinuationLine(line)) {
      if (inProcedureDivision && currentParagraph) {
        paragraphLines.push(line);
      } else {
        nonProcLines.push(line);
      }
      continue;
    }

    // Check for division
    const divMatch = line.match(DIVISION_PATTERN);
    if (divMatch) {
      flushParagraph();
      flushNonProc();
      currentDivision = divMatch[1].toUpperCase() + " DIVISION";
      currentSection = "";
      currentParagraph = "";
      inProcedureDivision = currentDivision === "PROCEDURE DIVISION";

      if (!inProcedureDivision) {
        nonProcDivision = currentDivision;
        nonProcStart = lineNum;
      }
      continue;
    }

    // Check for section
    const secMatch = line.match(SECTION_PATTERN);
    if (secMatch) {
      flushParagraph();
      if (!inProcedureDivision) flushNonProc();
      currentSection = secMatch[1].toUpperCase();
      if (!inProcedureDivision) {
        nonProcSection = currentSection;
        nonProcStart = lineNum;
      }
      continue;
    }

    if (inProcedureDivision) {
      // Check for paragraph start (name followed by a period at start of line)
      const paraMatch = line.match(PARAGRAPH_PATTERN);
      if (paraMatch) {
        flushParagraph();
        currentParagraph = paraMatch[1].toUpperCase();
        paragraphStartLine = lineNum;
        paragraphLines = [line];
        continue;
      }

      // Accumulate lines into current paragraph
      if (currentParagraph) {
        paragraphLines.push(line);
      } else {
        // Lines before first paragraph in procedure division
        nonProcLines.push(line);
        if (nonProcLines.length === 1) nonProcStart = lineNum;
      }
    } else {
      // Non-procedure division lines
      nonProcLines.push(line);
      if (nonProcLines.length === 1) {
        nonProcStart = lineNum;
        nonProcDivision = currentDivision;
        nonProcSection = currentSection;
      }
    }
  }

  // Flush remaining
  flushParagraph();
  flushNonProc();

  // If no structured chunks were found, do fixed-size on entire file
  if (chunks.length === 0) {
    return fixedSizeChunk(lines, 0, filePath, "UNKNOWN", "");
  }

  return chunks;
}

/**
 * Formats a chunk into a string suitable for embedding.
 * Includes metadata prefix + extracted comments for better retrieval.
 */
export function formatChunkForEmbedding(chunk: CobolChunk): string {
  const metaPrefix = [
    `File: ${chunk.metadata.filePath}`,
    `Lines: ${chunk.metadata.lineStart}-${chunk.metadata.lineEnd}`,
    chunk.metadata.division && `Division: ${chunk.metadata.division}`,
    chunk.metadata.section && `Section: ${chunk.metadata.section}`,
    chunk.metadata.paragraphName && `Paragraph: ${chunk.metadata.paragraphName}`,
    chunk.metadata.dependencies.length > 0 &&
      `Dependencies: ${chunk.metadata.dependencies.join(", ")}`,
    chunk.metadata.commentSummary && `Comments: ${chunk.metadata.commentSummary}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return `${metaPrefix}\n\n${chunk.content}`;
}
