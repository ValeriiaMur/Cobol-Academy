"use client";

import { useState } from "react";

interface CodeWalkthroughProps {
  cobolCode: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  paragraphName: string;
  division: string;
}

interface LineAnnotation {
  line: number;
  explanation: string;
  category: "structure" | "data" | "logic" | "io" | "control" | "comment" | "other";
}

export default function CodeWalkthrough({
  cobolCode,
  filePath,
  lineStart,
  paragraphName,
  division,
}: CodeWalkthroughProps) {
  const [annotations, setAnnotations] = useState<LineAnnotation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [error, setError] = useState("");

  const lines = cobolCode.split("\n");

  async function handleAnalyze() {
    setIsAnalyzing(true);
    setError("");

    try {
      const res = await fetch("/api/walkthrough", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cobolCode,
          filePath,
          paragraphName,
          division,
          lineStart,
        }),
      });

      if (!res.ok) throw new Error("Analysis failed");

      const data = await res.json();
      setAnnotations(data.annotations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const getAnnotation = (lineNum: number) =>
    annotations.find((a) => a.line === lineNum);

  const getCategoryStyle = (category: string) => {
    switch (category) {
      case "structure":
        return { bg: "bg-indigo-500/10", border: "border-indigo-500/30", dot: "bg-indigo-400", text: "text-indigo-300" };
      case "data":
        return { bg: "bg-violet-500/10", border: "border-violet-500/30", dot: "bg-violet-400", text: "text-violet-300" };
      case "logic":
        return { bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-400", text: "text-emerald-300" };
      case "io":
        return { bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-400", text: "text-amber-300" };
      case "control":
        return { bg: "bg-pink-500/10", border: "border-pink-500/30", dot: "bg-pink-400", text: "text-pink-300" };
      case "comment":
        return { bg: "bg-slate-500/10", border: "border-slate-500/30", dot: "bg-slate-400", text: "text-slate-400" };
      default:
        return { bg: "bg-cyan-500/10", border: "border-cyan-500/30", dot: "bg-cyan-400", text: "text-cyan-300" };
    }
  };

  return (
    <div className="mt-3 border border-[#1a2744] rounded-lg overflow-hidden bg-[#0a0e17]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0d1520] border-b border-[#1a2744]">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-xs font-medium text-[#e2e8f0]">Interactive Walkthrough</span>
          {annotations.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00d4aa]/20 text-[#00d4aa]">
              {annotations.length} annotations
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Legend */}
          {annotations.length > 0 && (
            <div className="hidden md:flex items-center gap-2 text-[10px]">
              {[
                { cat: "structure", label: "Structure" },
                { cat: "data", label: "Data" },
                { cat: "logic", label: "Logic" },
                { cat: "io", label: "I/O" },
                { cat: "control", label: "Control" },
              ].map(({ cat, label }) => {
                const style = getCategoryStyle(cat);
                return (
                  <span key={cat} className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                    <span className="text-[#64748b]">{label}</span>
                  </span>
                );
              })}
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="px-3 py-1 text-xs font-medium rounded-md bg-[#00d4aa]/20 text-[#00d4aa] hover:bg-[#00d4aa]/30 border border-[#00d4aa]/40 transition-all disabled:opacity-50"
          >
            {isAnalyzing ? "Analyzing..." : annotations.length > 0 ? "Re-analyze" : "Annotate Code"}
          </button>
        </div>
      </div>

      {/* Code with annotations */}
      <div className="max-h-[500px] overflow-y-auto">
        {error && (
          <div className="px-4 py-2 text-xs text-red-400 bg-red-500/10 border-b border-red-500/20">
            {error}
          </div>
        )}

        {isAnalyzing && annotations.length === 0 && (
          <div className="px-4 py-8 text-center">
            <div className="text-[#00d4aa] text-sm animate-pulse mb-2">Analyzing code line by line...</div>
            <div className="text-[#4a5568] text-xs">The AI is examining each line to create annotations</div>
          </div>
        )}

        <div className="font-mono text-xs">
          {lines.map((line, i) => {
            const lineNum = lineStart + i;
            const annotation = getAnnotation(lineNum);
            const isActive = activeLine === lineNum;
            const style = annotation ? getCategoryStyle(annotation.category) : null;
            const isComment = line.length > 6 && (line[6] === "*" || line[6] === "/");

            return (
              <div key={i}>
                {/* Code line */}
                <div
                  className={`flex items-stretch cursor-pointer transition-all group ${
                    isActive && annotation
                      ? `${style?.bg} border-l-2 ${style?.border}`
                      : annotation
                      ? "border-l-2 border-transparent hover:border-[#1a2744] hover:bg-[#0d1520]"
                      : "border-l-2 border-transparent"
                  }`}
                  onClick={() => annotation && setActiveLine(isActive ? null : lineNum)}
                >
                  {/* Line number */}
                  <span className="text-[#2a3a55] select-none w-10 text-right pr-3 py-0.5 flex-shrink-0 border-r border-[#1a2744]/50">
                    {lineNum}
                  </span>

                  {/* Annotation indicator */}
                  <span className="w-5 flex items-center justify-center flex-shrink-0">
                    {annotation && (
                      <span className={`w-1.5 h-1.5 rounded-full ${style?.dot} ${isActive ? "ring-2 ring-offset-1 ring-offset-[#0a0e17]" : ""}`} />
                    )}
                  </span>

                  {/* Code */}
                  <span className={`flex-1 py-0.5 pr-4 ${isComment ? "text-[#4a5568] italic" : "text-[#94a3b8]"}`}>
                    {line || " "}
                  </span>
                </div>

                {/* Annotation tooltip (expanded inline) */}
                {isActive && annotation && (
                  <div className={`mx-16 my-1 px-3 py-2 rounded-md ${style?.bg} border ${style?.border}`}>
                    <div className="flex items-start gap-2">
                      <span className={`${style?.dot} w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0`} />
                      <div>
                        <span className={`text-[10px] uppercase tracking-wider ${style?.text} font-medium`}>
                          {annotation.category}
                        </span>
                        <p className="text-[#c8d6e5] text-xs leading-relaxed mt-0.5">
                          {annotation.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary bar */}
      {annotations.length > 0 && (
        <div className="px-4 py-2 bg-[#0d1520] border-t border-[#1a2744] text-[10px] text-[#4a5568]">
          Click any highlighted line to see its annotation — {annotations.length} lines annotated out of {lines.length} total
        </div>
      )}
    </div>
  );
}
