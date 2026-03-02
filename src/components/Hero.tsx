"use client";

import { useState, useEffect } from "react";

const STATS = [
  { value: "95%", label: "of ATM transactions", detail: "run on COBOL" },
  { value: "800B+", label: "lines of COBOL", detail: "still in production" },
  { value: "$3T", label: "in daily commerce", detail: "processed by COBOL" },
  { value: "~60", label: "average age", detail: "of COBOL engineers" },
];

const SAMPLE_QUERIES = [
  "Where is the main entry point of the compiler?",
  "What functions handle file I/O operations?",
  "Explain the PROCEDURE DIVISION structure",
  "Show me error handling patterns",
  "What are the dependencies of the parser module?",
  "Find all PERFORM statements in the codebase",
];

export default function Hero({ onStartLearning }: { onStartLearning: () => void }) {
  const [currentQuery, setCurrentQuery] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const query = SAMPLE_QUERIES[currentQuery];
    let charIndex = 0;
    setDisplayText("");
    setIsTyping(true);

    const typeInterval = setInterval(() => {
      if (charIndex < query.length) {
        setDisplayText(query.substring(0, charIndex + 1));
        charIndex++;
      } else {
        setIsTyping(false);
        clearInterval(typeInterval);
        setTimeout(() => {
          setCurrentQuery((prev) => (prev + 1) % SAMPLE_QUERIES.length);
        }, 2500);
      }
    }, 45);

    return () => clearInterval(typeInterval);
  }, [currentQuery]);

  return (
    <section className="relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00d4aa] opacity-[0.03] rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#0066ff] opacity-[0.04] rounded-full blur-[100px]" />

      <div className="max-w-6xl mx-auto px-4 pt-6 pb-10">
        {/* Nav */}
        <nav className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d4aa] to-[#0088ff] flex items-center justify-center">
              <span className="text-[#0a0e17] font-bold text-sm font-mono">{`>`}_</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">
              COBOL <span className="text-[#00d4aa]">Academy</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#94a3b8]">
            <a href="#crisis" className="hover:text-[#00d4aa] transition-colors">
              The Crisis
            </a>
            <a href="#features" className="hover:text-[#00d4aa] transition-colors">
              Features
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#00d4aa] transition-colors"
            >
              GitHub
            </a>
          </div>
        </nav>

        {/* Main Hero */}
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#00d4aa]/20 bg-[#00d4aa]/5 text-[#00d4aa] text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] animate-pulse" />
            AI-Powered Learning — Trained on Real COBOL Code
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Understand the language
            <br />
            that{" "}
            <span className="text-glow text-[#00d4aa]">quietly runs</span>
            <br />
            the world
          </h1>

          <p className="text-lg md:text-xl text-[#94a3b8] max-w-2xl mx-auto mb-6 leading-relaxed">
            COBOL powers 95% of ATM swipes, 80% of in-person transactions, and
            systems that move <strong className="text-[#e2e8f0]">$3 trillion daily</strong>. The engineers who
            understand it are retiring.{" "}
            <strong className="text-[#e2e8f0]">The code isn&apos;t.</strong>
          </p>

          <p className="text-base text-[#64748b] max-w-xl mx-auto mb-10">
            COBOL Academy uses AI trained on the{" "}
            <span className="text-[#00d4aa]">GnuCOBOL compiler source code</span> to help
            you explore, understand, and learn the language that financial
            institutions can&apos;t live without.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <button
              onClick={() => {
                onStartLearning();
                setTimeout(() => {
                  document.getElementById("query")?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="px-8 py-3.5 bg-[#00d4aa] text-[#0a0e17] font-semibold rounded-lg hover:bg-[#00e8bb] transition-all hover:shadow-[0_0_30px_rgba(0,212,170,0.3)] active:scale-[0.98]"
            >
              Start Exploring COBOL
            </button>
            <a
              href="#crisis"
              className="px-8 py-3.5 border border-[#1a2744] text-[#94a3b8] font-medium rounded-lg hover:border-[#00d4aa]/30 hover:text-[#e2e8f0] transition-all"
            >
              Why COBOL Matters
            </a>
          </div>

          {/* Typewriter Demo */}
          <div className="max-w-2xl mx-auto">
            <div className="rounded-xl bg-[#0d1520] border border-[#1a2744] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1a2744] bg-[#0a0e17]/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-xs text-[#4a5568] font-mono ml-2">
                  cobol-academy — natural language query
                </span>
              </div>
              <div className="p-5 font-mono text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-[#00d4aa] shrink-0">{">"}</span>
                  <span className="text-[#e2e8f0]">
                    {displayText}
                    {isTyping && (
                      <span className="cursor-blink text-[#00d4aa]">▌</span>
                    )}
                  </span>
                </div>
                {!isTyping && (
                  <div className="mt-3 text-[#4a5568] animate-fade-in">
                    <span className="text-[#00d4aa]">✓</span> Searching 300+ COBOL
                    files... Found 5 relevant matches
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 max-w-4xl mx-auto">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="stat-glow rounded-xl p-5 text-center"
            >
              <div className="text-2xl md:text-3xl font-bold text-[#00d4aa] mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-[#94a3b8]">{stat.label}</div>
              <div className="text-xs text-[#4a5568] mt-0.5">{stat.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
