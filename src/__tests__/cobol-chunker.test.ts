import { describe, it, expect } from "vitest";
import { chunkCobolFile, formatChunkForEmbedding } from "../lib/cobol-chunker";

// COBOL uses fixed-column formatting:
// Columns 1-6: sequence number area (optional)
// Column 7: indicator (* = comment, - = continuation)
// Columns 8-72: code area
// The paragraph regex expects names in columns 0-5 (up to 6 chars indent)

describe("chunkCobolFile", () => {
  it("splits on PROCEDURE DIVISION paragraph boundaries", () => {
    const source = [
      "       IDENTIFICATION DIVISION.",
      "       PROGRAM-ID. TEST-PROG.",
      "       PROCEDURE DIVISION.",
      "MAIN-P.",
      "           DISPLAY \"Hello\".",
      "           STOP RUN.",
      "SUB-P.",
      "           DISPLAY \"World\".",
    ].join("\n");

    const chunks = chunkCobolFile(source, "test.cob");
    const paragraphChunks = chunks.filter((c) => c.metadata.chunkType === "paragraph");
    expect(paragraphChunks.length).toBe(2);
    expect(paragraphChunks[0].metadata.paragraphName).toBe("MAIN-P");
    expect(paragraphChunks[1].metadata.paragraphName).toBe("SUB-P");
  });

  it("uses fixed-size chunking for non-procedure divisions", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `       05 FIELD-${i} PIC X(10).`);
    const source = `       DATA DIVISION.\n       WORKING-STORAGE SECTION.\n${lines.join("\n")}`;

    const chunks = chunkCobolFile(source, "test.cob");
    const fixedChunks = chunks.filter((c) => c.metadata.chunkType === "fixed");
    expect(fixedChunks.length).toBeGreaterThan(0);
  });

  it("extracts PERFORM dependencies", () => {
    const source = [
      "       PROCEDURE DIVISION.",
      "MAIN-P.",
      "           PERFORM SUB-ROUTINE",
      "           PERFORM ANOTHER-ROUTINE",
      "           STOP RUN.",
    ].join("\n");

    const chunks = chunkCobolFile(source, "test.cob");
    const mainChunk = chunks.find((c) => c.metadata.paragraphName === "MAIN-P");
    expect(mainChunk).toBeDefined();
    expect(mainChunk!.metadata.dependencies).toContain("PERFORM:SUB-ROUTINE");
    expect(mainChunk!.metadata.dependencies).toContain("PERFORM:ANOTHER-ROUTINE");
  });

  it("extracts COPY dependencies", () => {
    const source = [
      "       PROCEDURE DIVISION.",
      "INIT-P.",
      "           COPY CUSTOMER-REC.",
      "           DISPLAY \"Done\".",
    ].join("\n");

    const chunks = chunkCobolFile(source, "test.cob");
    const chunk = chunks.find((c) => c.metadata.paragraphName === "INIT-P");
    expect(chunk).toBeDefined();
    expect(chunk!.metadata.dependencies).toContain("COPY:CUSTOMER-REC");
  });

  it("handles comment lines correctly", () => {
    const source = [
      "      * This is a file comment",
      "       PROCEDURE DIVISION.",
      "MAIN-P.",
      "      * Inside paragraph comment",
      "           DISPLAY \"Test\".",
    ].join("\n");

    const chunks = chunkCobolFile(source, "test.cob");
    const mainChunk = chunks.find((c) => c.metadata.paragraphName === "MAIN-P");
    expect(mainChunk).toBeDefined();
    expect(mainChunk!.metadata.commentSummary).toContain("Inside paragraph comment");
  });

  it("normalizes encoding issues", () => {
    const source = "\uFEFF       PROCEDURE DIVISION.\r\nTEST-P.\r\n           DISPLAY \"Hello\".";

    const chunks = chunkCobolFile(source, "test.cob");
    expect(chunks.length).toBeGreaterThan(0);
    const allContent = chunks.map((c) => c.content).join("");
    expect(allContent).not.toContain("\uFEFF");
    expect(allContent).not.toContain("\r");
  });

  it("calculates complexity score", () => {
    const source = [
      "       PROCEDURE DIVISION.",
      "CMPLX.",
      "           IF WS-FLAG = 1",
      "               PERFORM SUB-A",
      "               PERFORM SUB-B",
      "           ELSE",
      "               EVALUATE WS-CODE",
      "                   WHEN 1",
      "                       READ INPUT-FILE",
      "                   WHEN 2",
      "                       WRITE OUTPUT-REC",
      "               END-EVALUATE",
      "           END-IF.",
    ].join("\n");

    const chunks = chunkCobolFile(source, "test.cob");
    const chunk = chunks.find((c) => c.metadata.paragraphName === "CMPLX");
    expect(chunk).toBeDefined();
    expect(chunk!.metadata.complexity).toBeGreaterThan(0);
  });

  it("falls back to fixed-size chunking for unstructured files", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Line ${i}: some content`);
    const source = lines.join("\n");

    const chunks = chunkCobolFile(source, "unstructured.txt");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.chunkType).toBe("fixed");
  });

  it("preserves correct line numbers", () => {
    const source = [
      "       IDENTIFICATION DIVISION.",
      "       PROGRAM-ID. TEST.",
      "       PROCEDURE DIVISION.",
      "MY-P.",
      "           DISPLAY \"Hello\".",
      "           DISPLAY \"World\".",
    ].join("\n");

    const chunks = chunkCobolFile(source, "test.cob");
    const para = chunks.find((c) => c.metadata.paragraphName === "MY-P");
    expect(para).toBeDefined();
    expect(para!.metadata.lineStart).toBe(4);
  });

  it("tracks division correctly", () => {
    const source = [
      "       PROCEDURE DIVISION.",
      "MY-P.",
      "           DISPLAY \"Test\".",
    ].join("\n");

    const chunks = chunkCobolFile(source, "test.cob");
    const para = chunks.find((c) => c.metadata.paragraphName === "MY-P");
    expect(para).toBeDefined();
    expect(para!.metadata.division).toBe("PROCEDURE DIVISION");
  });
});

describe("formatChunkForEmbedding", () => {
  it("includes metadata prefix in embedding text", () => {
    const chunk = {
      content: "DISPLAY 'Hello'.",
      metadata: {
        filePath: "test.cob",
        lineStart: 10,
        lineEnd: 12,
        division: "PROCEDURE DIVISION",
        section: "MAIN-SECTION",
        paragraphName: "INIT-PARA",
        chunkType: "paragraph" as const,
        dependencies: ["PERFORM:SUB-A"],
        commentSummary: "Initialize system",
        linesOfCode: 3,
        complexity: 1,
      },
    };

    const result = formatChunkForEmbedding(chunk);
    expect(result).toContain("File: test.cob");
    expect(result).toContain("Lines: 10-12");
    expect(result).toContain("Division: PROCEDURE DIVISION");
    expect(result).toContain("Paragraph: INIT-PARA");
    expect(result).toContain("Dependencies: PERFORM:SUB-A");
    expect(result).toContain("DISPLAY 'Hello'.");
  });

  it("omits empty optional fields", () => {
    const chunk = {
      content: "some code",
      metadata: {
        filePath: "test.cob",
        lineStart: 1,
        lineEnd: 5,
        division: "",
        section: "",
        paragraphName: "",
        chunkType: "fixed" as const,
        dependencies: [],
        commentSummary: "",
        linesOfCode: 5,
        complexity: 0,
      },
    };

    const result = formatChunkForEmbedding(chunk);
    expect(result).toContain("File: test.cob");
    expect(result).not.toContain("Division:");
    expect(result).not.toContain("Paragraph:");
    expect(result).not.toContain("Dependencies:");
  });
});
