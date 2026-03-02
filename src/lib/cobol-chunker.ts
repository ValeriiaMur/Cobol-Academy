/**
 * COBOL-Aware Syntax Chunker
 *
 * Splits COBOL source files using paragraph-level boundaries,
 * which are the natural semantic units in COBOL code.
 * Falls back to fixed-size chunking for non-procedural divisions.
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
    dependencies: string[]; // PERFORM targets, COPY statements
  };
}

// COBOL division patterns
const DIVISION_PATTERN = /^[\s]*(\w[\w-]*)\s+DIVISION\b/i;
const SECTION_PATTERN = /^[\s]*(\w[\w-]*)\s+SECTION\b/i;
const PARAGRAPH_PATTERN = /^[\s]{0,6}(\w[\w-]*)\.\s*$/;
const PERFORM_PATTERN = /\bPERFORM\s+([\w-]+)/gi;
const COPY_PATTERN = /\bCOPY\s+([\w-]+)/gi;
const CALL_PATTERN = /\bCALL\s+['"]?([\w-]+)/gi;

// Fixed-size chunking params for non-procedure code
const FIXED_CHUNK_SIZE = 40; // lines
const FIXED_CHUNK_OVERLAP = 5; // lines

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
        dependencies: extractDependencies(content),
      },
    });
  }

  return chunks;
}

export function chunkCobolFile(source: string, filePath: string): CobolChunk[] {
  const lines = source.split("\n");
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

    // Skip comment lines (column 7 = *)
    const col7 = line.length > 6 ? line[6] : " ";
    if (col7 === "*" || col7 === "/") continue;

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
 * Includes metadata prefix for better retrieval.
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
  ]
    .filter(Boolean)
    .join(" | ");

  return `${metaPrefix}\n\n${chunk.content}`;
}
