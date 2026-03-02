"use client";

const FEATURES = [
  {
    icon: "🔍",
    title: "Code Explanation",
    description:
      "Ask about any function, paragraph, or section and get plain English explanations with specific line references.",
    example: '"What does CALCULATE-INTEREST do?" → Clear breakdown with code refs',
    tag: "Core Feature",
  },
  {
    icon: "🔄",
    title: "Translation Hints",
    description:
      "See modern language equivalents for COBOL constructs. Bridge the gap between legacy and contemporary coding.",
    example: '"PERFORM VARYING" → "This is like a for loop in Python"',
    tag: "Learn Faster",
  },
  {
    icon: "🔗",
    title: "Pattern Detection",
    description:
      "Find similar code patterns across the entire codebase. Understand recurring idioms and conventions.",
    example: '"Show me file I/O patterns" → All OPEN/READ/WRITE locations',
    tag: "Deep Analysis",
  },
  {
    icon: "📊",
    title: "Business Logic Extraction",
    description:
      "Identify the business rules hidden in legacy code. Understand not just what the code does, but why.",
    example: '"What business rules are in the billing module?"',
    tag: "Enterprise",
  },
];

const TECH_STACK = [
  { name: "Pinecone", role: "Vector Database", detail: "Semantic search across 300+ files" },
  { name: "OpenAI", role: "Embeddings + LLM", detail: "text-embedding-3-small + GPT-4o-mini" },
  { name: "LangChain", role: "RAG Framework", detail: "Retrieval and context assembly" },
  { name: "Next.js", role: "Full-Stack App", detail: "API routes + React frontend" },
  { name: "GnuCOBOL", role: "Target Codebase", detail: "200K+ lines of real COBOL" },
  { name: "Vercel", role: "Deployment", detail: "Edge-optimized, publicly accessible" },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="px-4 py-14">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-xs font-mono text-[#00d4aa] tracking-widest uppercase mb-4 block">
            How It Works
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            AI trained on{" "}
            <span className="text-[#00d4aa]">real COBOL code</span>
          </h2>
          <p className="text-[#64748b] max-w-xl mx-auto">
            Not generic AI responses — answers grounded in actual source code from
            the GnuCOBOL compiler, with file paths and line numbers.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-2 gap-5 mb-20">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl bg-[#0d1520] border border-[#1a2744] p-6 hover:border-[#00d4aa]/20 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{feature.icon}</span>
                <span className="text-[10px] font-mono text-[#00d4aa] px-2 py-0.5 rounded-full border border-[#00d4aa]/20 bg-[#00d4aa]/5">
                  {feature.tag}
                </span>
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-[#00d4aa] transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-[#94a3b8] mb-3 leading-relaxed">
                {feature.description}
              </p>
              <div className="text-xs font-mono text-[#4a5568] bg-[#0a0e17] rounded-lg px-3 py-2">
                {feature.example}
              </div>
            </div>
          ))}
        </div>

        {/* RAG Pipeline Visualization */}
        <div className="mb-20">
          <h3 className="text-center text-xl font-semibold mb-8">
            The RAG Pipeline
          </h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-3 text-sm">
            {[
              { step: "1", label: "Your Question", sub: "Natural language" },
              { step: "2", label: "Embed Query", sub: "1536-dim vector" },
              { step: "3", label: "Search Pinecone", sub: "Top-5 matches" },
              { step: "4", label: "Assemble Context", sub: "Code + metadata" },
              { step: "5", label: "AI Answer", sub: "GPT-4o-mini streams" },
            ].map((item, i) => (
              <div key={item.step} className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-[#00d4aa]/10 border border-[#00d4aa]/30 flex items-center justify-center text-[#00d4aa] font-bold text-sm">
                    {item.step}
                  </div>
                  <div className="text-xs font-medium text-[#e2e8f0] mt-2">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-[#4a5568]">{item.sub}</div>
                </div>
                {i < 4 && (
                  <div className="hidden md:block text-[#1a2744] text-xl">→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div>
          <h3 className="text-center text-xl font-semibold mb-8">
            Built With
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {TECH_STACK.map((tech) => (
              <div
                key={tech.name}
                className="rounded-lg bg-[#0d1520] border border-[#1a2744] p-4 hover:border-[#00d4aa]/20 transition-all"
              >
                <div className="text-sm font-semibold text-[#e2e8f0]">
                  {tech.name}
                </div>
                <div className="text-xs text-[#00d4aa] mb-1">{tech.role}</div>
                <div className="text-xs text-[#4a5568]">{tech.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
