"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SearchResult {
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

const SUGGESTED_QUERIES = [
  "Where is the main entry point?",
  "What functions modify CUSTOMER-RECORD?",
  "Explain the CALCULATE-INTEREST paragraph",
  "Find all file I/O operations",
  "Show me error handling patterns",
  "What are the dependencies of the parser?",
];

interface QueryInterfaceProps {
  onQueryComplete?: (results: SearchResult[], query: string, latencyMs: number) => void;
}

export default function QueryInterface({ onQueryComplete }: QueryInterfaceProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [latencyMs, setLatencyMs] = useState(0);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (answerRef.current && answer) {
      answerRef.current.scrollTop = answerRef.current.scrollHeight;
    }
  }, [answer]);

  async function handleSearch(searchQuery?: string) {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setError("");
    setAnswer("");
    setResults([]);
    setIsSearching(true);
    setIsAnswering(false);
    setExpandedResult(null);

    try {
      // Step 1: Search
      const searchRes = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, topK: 5 }),
      });

      if (!searchRes.ok) {
        const errData = await searchRes.json();
        throw new Error(errData.error || "Search failed");
      }

      const searchData = await searchRes.json();
      setResults(searchData.results);
      setLatencyMs(searchData.latencyMs);
      setIsSearching(false);
      onQueryComplete?.(searchData.results, q, searchData.latencyMs);

      // Step 2: Get AI answer via streaming
      setIsAnswering(true);
      const answerRes = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, topK: 5 }),
      });

      if (!answerRes.ok) {
        const errData = await answerRes.json();
        throw new Error(errData.error || "Answer generation failed");
      }

      // Read SSE stream
      const reader = answerRes.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let accumulated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  accumulated += parsed.content;
                  setAnswer(accumulated);
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }
        }
      }

      setIsAnswering(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSearching(false);
      setIsAnswering(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto" id="query-interface">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">
          Ask anything about the{" "}
          <span className="text-[#00d4aa]">GnuCOBOL</span> codebase
        </h2>
        <p className="text-[#64748b] text-sm">
          Powered by RAG — your question is matched against 300+ COBOL source files
        </p>
      </div>

      {/* Search Input */}
      <div className="relative mb-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. Where is the main entry point of the compiler?"
              className="w-full px-5 py-4 rounded-xl bg-[#0d1520] border border-[#1a2744] text-[#e2e8f0] placeholder-[#4a5568] focus:border-[#00d4aa]/50 focus:outline-none focus:ring-1 focus:ring-[#00d4aa]/20 font-mono text-sm transition-all"
              disabled={isSearching || isAnswering}
            />
            {(isSearching || isAnswering) && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="streaming-dot" />
              </div>
            )}
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={isSearching || isAnswering || !query.trim()}
            className="px-6 py-4 bg-[#00d4aa] text-[#0a0e17] font-semibold rounded-xl hover:bg-[#00e8bb] transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isSearching ? "Searching..." : isAnswering ? "Thinking..." : "Search"}
          </button>
        </div>
      </div>

      {/* Suggested Queries */}
      {!results.length && !answer && !error && (
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {SUGGESTED_QUERIES.map((sq) => (
            <button
              key={sq}
              onClick={() => {
                setQuery(sq);
                handleSearch(sq);
              }}
              className="px-3 py-1.5 rounded-lg border border-[#1a2744] text-[#64748b] text-xs font-mono hover:border-[#00d4aa]/30 hover:text-[#00d4aa] transition-all"
            >
              {sq}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Retrieval Summary Bar */}
      {results.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3 px-1">
          <div className="flex items-center gap-1.5 text-xs bg-[#0d1520] border border-[#1a2744] rounded-lg px-3 py-1.5">
            <span className="text-[#4a5568]">Retrieved</span>
            <span className="text-[#00d4aa] font-mono font-medium">{results.length}</span>
            <span className="text-[#4a5568]">chunks</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs bg-[#0d1520] border border-[#1a2744] rounded-lg px-3 py-1.5">
            <span className="text-[#4a5568]">Latency</span>
            <span className="text-[#e2e8f0] font-mono">{latencyMs}ms</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs bg-[#0d1520] border border-[#1a2744] rounded-lg px-3 py-1.5">
            <span className="text-[#4a5568]">Top score</span>
            <span className="text-[#00d4aa] font-mono">{(results[0]?.score * 100).toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs bg-[#0d1520] border border-[#1a2744] rounded-lg px-3 py-1.5">
            <span className="text-[#4a5568]">Files hit</span>
            <span className="text-[#e2e8f0] font-mono">
              {new Set(results.map((r) => r.filePath)).size}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs bg-[#0d1520] border border-[#1a2744] rounded-lg px-3 py-1.5">
            <span className="text-[#4a5568]">Divisions</span>
            <span className="text-[#e2e8f0] font-mono">
              {[...new Set(results.map((r) => r.division).filter(Boolean))].join(", ") || "—"}
            </span>
          </div>
        </div>
      )}

      {/* Results Layout */}
      {(results.length > 0 || answer) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* AI Answer - Main Column */}
          <div className="lg:col-span-3 order-1">
            {(answer || isAnswering) && (
              <div className="rounded-xl bg-[#0d1520] border border-[#00d4aa]/20 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[#1a2744] flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#00d4aa]" />
                  <span className="text-xs font-medium text-[#00d4aa]">
                    AI Explanation
                  </span>
                  {isAnswering && (
                    <span className="text-xs text-[#4a5568] ml-auto">
                      generating...
                    </span>
                  )}
                  {!isAnswering && answer && (
                    <span className="text-xs text-[#4a5568] ml-auto font-mono">
                      GPT-4o-mini · {results.length} sources
                    </span>
                  )}
                </div>
                <div
                  ref={answerRef}
                  className="p-5 max-h-[500px] overflow-y-auto markdown-answer"
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 className="text-xl font-bold text-[#e2e8f0] mb-3 mt-4 first:mt-0">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold text-[#e2e8f0] mb-2 mt-4 first:mt-0">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-semibold text-[#e2e8f0] mb-2 mt-3 first:mt-0">{children}</h3>,
                      h4: ({ children }) => <h4 className="text-sm font-semibold text-[#c8d6e5] mb-1 mt-2">{children}</h4>,
                      p: ({ children }) => <p className="text-[#c8d6e5] leading-relaxed text-sm mb-3 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside text-[#c8d6e5] text-sm mb-3 space-y-1 pl-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside text-[#c8d6e5] text-sm mb-3 space-y-1 pl-2">{children}</ol>,
                      li: ({ children }) => <li className="text-[#c8d6e5] text-sm leading-relaxed">{children}</li>,
                      code: ({ className, children, ...props }) => {
                        const isInline = !className;
                        if (isInline) {
                          return <code className="bg-[#1a2744] text-[#00d4aa] px-1.5 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>;
                        }
                        return (
                          <code className={`block bg-[#0a0e17] border border-[#1a2744] rounded-lg p-3 text-xs font-mono text-[#94a3b8] overflow-x-auto mb-3 ${className || ""}`} {...props}>
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => <pre className="bg-[#0a0e17] border border-[#1a2744] rounded-lg p-3 overflow-x-auto mb-3">{children}</pre>,
                      strong: ({ children }) => <strong className="text-[#e2e8f0] font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="text-[#94a3b8] italic">{children}</em>,
                      a: ({ children, href }) => <a href={href} className="text-[#00d4aa] hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-[#00d4aa]/40 pl-3 my-2 text-[#94a3b8] italic">{children}</blockquote>,
                      table: ({ children }) => <div className="overflow-x-auto mb-3"><table className="min-w-full text-xs text-[#c8d6e5] border-collapse">{children}</table></div>,
                      th: ({ children }) => <th className="border border-[#1a2744] px-2 py-1 bg-[#0a0e17] text-left font-semibold text-[#e2e8f0]">{children}</th>,
                      td: ({ children }) => <td className="border border-[#1a2744] px-2 py-1">{children}</td>,
                      hr: () => <hr className="border-[#1a2744] my-3" />,
                    }}
                  >
                    {answer}
                  </ReactMarkdown>
                  {isAnswering && <span className="cursor-blink text-[#00d4aa]">▌</span>}
                </div>
              </div>
            )}
          </div>

          {/* Source Results - Side Column */}
          <div className="lg:col-span-2 order-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[#94a3b8]">
                Source Code ({results.length} matches)
              </h3>
            </div>

            <div className="space-y-3">
              {results.map((result, i) => (
                <div
                  key={result.id}
                  className="result-card rounded-lg bg-[#0d1520] overflow-hidden cursor-pointer"
                  onClick={() =>
                    setExpandedResult(expandedResult === i ? null : i)
                  }
                >
                  {/* Result Header */}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-[#00d4aa] truncate max-w-[200px]">
                        {result.filePath}
                      </span>
                      {/* Score bar */}
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <div className="w-12 h-1.5 bg-[#1a2744] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${result.score * 100}%`,
                              background: result.score > 0.8 ? "#00d4aa" : result.score > 0.6 ? "#ffd93d" : "#64748b",
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-[#4a5568] font-mono w-8 text-right">
                          {(result.score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#64748b] flex-wrap">
                      <span className="font-mono bg-[#0a0e17] px-1.5 py-0.5 rounded text-[10px]">
                        L{result.lineStart}–{result.lineEnd}
                      </span>
                      {result.paragraphName && (
                        <span className="text-[#00d4aa]/70 bg-[#00d4aa]/5 px-1.5 py-0.5 rounded text-[10px]">
                          {result.paragraphName}
                        </span>
                      )}
                      {result.division && (
                        <span className="bg-[#0a0e17] px-1.5 py-0.5 rounded text-[10px]">
                          {result.division}
                        </span>
                      )}
                      {result.chunkType && (
                        <span className="bg-[#0a0e17] px-1.5 py-0.5 rounded text-[10px] text-[#4a5568]">
                          {result.chunkType}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Code */}
                  {expandedResult === i && (
                    <div className="border-t border-[#1a2744]">
                      <pre className="p-4 text-xs font-mono text-[#94a3b8] overflow-x-auto max-h-[300px] overflow-y-auto leading-relaxed">
                        {result.content
                          .split("\n")
                          .map((line, lineIdx) => (
                            <div key={lineIdx} className="flex hover:bg-[#111b2e]">
                              <span className="text-[#4a5568] select-none w-10 shrink-0 text-right pr-3">
                                {result.lineStart + lineIdx}
                              </span>
                              <span className="text-[#c8d6e5]">{line}</span>
                            </div>
                          ))}
                      </pre>
                      {result.dependencies.length > 0 && (
                        <div className="px-4 py-2 border-t border-[#1a2744]">
                          <div className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-1">Dependencies</div>
                          <div className="flex flex-wrap gap-1">
                            {result.dependencies.map((dep) => (
                              <span
                                key={dep}
                                className="text-[10px] font-mono bg-[#0a0e17] text-[#94a3b8] px-1.5 py-0.5 rounded border border-[#1a2744]"
                              >
                                {dep}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.section && (
                        <div className="px-4 py-2 border-t border-[#1a2744] text-[10px] text-[#4a5568]">
                          Section: <span className="text-[#94a3b8] font-mono">{result.section}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
