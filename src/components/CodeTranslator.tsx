"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CodeTranslatorProps {
  cobolCode: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  paragraphName: string;
  division: string;
}

const LANGUAGES = [
  { id: "python", label: "Python", icon: "🐍" },
  { id: "javascript", label: "JavaScript", icon: "⚡" },
  { id: "java", label: "Java", icon: "☕" },
];

export default function CodeTranslator({
  cobolCode,
  filePath,
  lineStart,
  lineEnd,
  paragraphName,
  division,
}: CodeTranslatorProps) {
  const [targetLang, setTargetLang] = useState("python");
  const [translation, setTranslation] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState("");

  async function handleTranslate() {
    setIsTranslating(true);
    setError("");
    setTranslation("");

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cobolCode,
          targetLang,
          filePath,
          paragraphName,
          division,
        }),
      });

      if (!res.ok) throw new Error("Translation failed");

      // Stream the response
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                full += parsed.content;
                setTranslation(full);
              }
            } catch {
              // skip
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setIsTranslating(false);
    }
  }

  return (
    <div className="mt-3 border border-[#1a2744] rounded-lg overflow-hidden bg-[#0a0e17]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0d1520] border-b border-[#1a2744]">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span className="text-xs font-medium text-[#e2e8f0]">Side-by-Side Translator</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Language selector */}
          <div className="flex gap-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                onClick={() => setTargetLang(lang.id)}
                className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                  targetLang === lang.id
                    ? "bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]/40"
                    : "text-[#64748b] hover:text-[#94a3b8] border border-transparent hover:border-[#1a2744]"
                }`}
              >
                {lang.icon} {lang.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleTranslate}
            disabled={isTranslating}
            className="px-3 py-1 text-xs font-medium rounded-md bg-[#00d4aa]/20 text-[#00d4aa] hover:bg-[#00d4aa]/30 border border-[#00d4aa]/40 transition-all disabled:opacity-50"
          >
            {isTranslating ? "Translating..." : "Translate"}
          </button>
        </div>
      </div>

      {/* Side by side view */}
      <div className="grid grid-cols-2 divide-x divide-[#1a2744]">
        {/* COBOL side */}
        <div className="p-0">
          <div className="px-3 py-1.5 bg-[#111b2e] text-[10px] uppercase tracking-wider text-[#4a5568] border-b border-[#1a2744]">
            COBOL — {filePath} (L{lineStart}–{lineEnd})
          </div>
          <pre className="p-3 text-xs font-mono text-[#94a3b8] overflow-x-auto max-h-[300px] overflow-y-auto leading-relaxed">
            {cobolCode.split("\n").map((line, i) => (
              <div key={i} className="flex">
                <span className="text-[#2a3a55] select-none w-8 text-right mr-3 flex-shrink-0">
                  {lineStart + i}
                </span>
                <span>{highlightCobol(line)}</span>
              </div>
            ))}
          </pre>
        </div>

        {/* Translation side */}
        <div className="p-0">
          <div className="px-3 py-1.5 bg-[#111b2e] text-[10px] uppercase tracking-wider text-[#4a5568] border-b border-[#1a2744]">
            {LANGUAGES.find((l) => l.id === targetLang)?.icon}{" "}
            {LANGUAGES.find((l) => l.id === targetLang)?.label} Equivalent
          </div>
          <div className="p-3 text-xs max-h-[300px] overflow-y-auto">
            {!translation && !isTranslating && !error && (
              <div className="text-[#4a5568] italic text-center py-8">
                Click &quot;Translate&quot; to see the {LANGUAGES.find((l) => l.id === targetLang)?.label} equivalent
              </div>
            )}
            {isTranslating && !translation && (
              <div className="text-[#00d4aa] text-center py-8 animate-pulse">
                Generating translation...
              </div>
            )}
            {error && (
              <div className="text-red-400 text-center py-8">{error}</div>
            )}
            {translation && (
              <div className="prose prose-invert prose-xs max-w-none translate-markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code: ({ className, children, ...props }) => {
                      const isInline = !className;
                      if (isInline) {
                        return (
                          <code className="bg-[#1a2744] text-[#00d4aa] px-1 py-0.5 rounded text-xs font-mono" {...props}>
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code
                          className="block bg-[#060a12] border border-[#1a2744] rounded p-2.5 text-xs font-mono text-[#94a3b8] overflow-x-auto whitespace-pre"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => <pre className="bg-transparent p-0 m-0">{children}</pre>,
                    p: ({ children }) => <p className="text-[#c8d6e5] text-xs leading-relaxed mb-2 last:mb-0">{children}</p>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold text-[#e2e8f0] mb-1 mt-2">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc list-inside text-[#c8d6e5] text-xs mb-2 space-y-0.5">{children}</ul>,
                    strong: ({ children }) => <strong className="text-[#e2e8f0]">{children}</strong>,
                  }}
                >
                  {translation}
                </ReactMarkdown>
                {isTranslating && <span className="text-[#00d4aa] animate-pulse">▌</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Basic COBOL syntax highlighting
 */
function highlightCobol(line: string): React.ReactNode {
  // Comment lines
  if (line.length > 6 && (line[6] === "*" || line[6] === "/")) {
    return <span className="text-[#4a5568] italic">{line}</span>;
  }

  // Highlight keywords
  const parts: React.ReactNode[] = [];
  const keywords =
    /\b(IDENTIFICATION|ENVIRONMENT|DATA|PROCEDURE|DIVISION|SECTION|WORKING-STORAGE|LINKAGE|FILE|PROGRAM-ID|PERFORM|MOVE|IF|ELSE|END-IF|EVALUATE|WHEN|END-EVALUATE|DISPLAY|ACCEPT|CALL|COPY|OPEN|READ|WRITE|CLOSE|REWRITE|ADD|SUBTRACT|MULTIPLY|DIVIDE|COMPUTE|GO\s+TO|STOP\s+RUN|EXIT|PIC|PICTURE|VALUE|USAGE|BINARY|COMP|OCCURS|REDEFINES|FD|SD|SELECT|ASSIGN|ORGANIZATION|ACCESS|STATUS|USING)\b/gi;

  let lastIndex = 0;
  let match;
  const text = line;

  while ((match = keywords.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const word = match[0].toUpperCase();

    // Color by category
    let colorClass = "text-[#7dd3fc]"; // default: sky blue
    if (["IDENTIFICATION", "ENVIRONMENT", "DATA", "PROCEDURE", "DIVISION", "SECTION", "WORKING-STORAGE", "LINKAGE", "FILE"].includes(word)) {
      colorClass = "text-[#818cf8] font-semibold"; // indigo — structural
    } else if (["PERFORM", "CALL", "GO TO", "EXIT", "STOP RUN"].includes(word) || word === "GO TO") {
      colorClass = "text-[#f472b6]"; // pink — control flow
    } else if (["MOVE", "ADD", "SUBTRACT", "MULTIPLY", "DIVIDE", "COMPUTE"].includes(word)) {
      colorClass = "text-[#34d399]"; // emerald — data operations
    } else if (["OPEN", "READ", "WRITE", "CLOSE", "REWRITE", "ACCEPT", "DISPLAY"].includes(word)) {
      colorClass = "text-[#fbbf24]"; // amber — I/O
    } else if (["IF", "ELSE", "END-IF", "EVALUATE", "WHEN", "END-EVALUATE"].includes(word)) {
      colorClass = "text-[#fb923c]"; // orange — conditionals
    } else if (["PIC", "PICTURE", "VALUE", "USAGE", "BINARY", "COMP", "OCCURS", "REDEFINES"].includes(word)) {
      colorClass = "text-[#a78bfa]"; // violet — data definition
    } else if (["FD", "SD", "SELECT", "ASSIGN", "ORGANIZATION", "ACCESS", "STATUS", "COPY", "USING"].includes(word)) {
      colorClass = "text-[#67e8f9]"; // cyan — file/system
    }

    parts.push(
      <span key={match.index} className={colorClass}>
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : line;
}
