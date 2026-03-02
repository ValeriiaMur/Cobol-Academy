"use client";

export default function CrisisSection() {
  return (
    <section id="crisis" className="px-4 py-14 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00d4aa]/[0.02] to-transparent" />

      <div className="max-w-5xl mx-auto relative">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-xs font-mono text-[#00d4aa] tracking-widest uppercase mb-4 block">
            The COBOL Crisis
          </span>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            A <span className="text-[#00d4aa]">$trillions</span> problem
            <br />
            hiding in plain sight
          </h2>
          <p className="text-[#64748b] max-w-2xl mx-auto">
            The world runs on code that fewer and fewer people can read. That&apos;s not a
            future problem — it&apos;s happening right now.
          </p>
        </div>

        {/* Crisis Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="rounded-xl bg-[#0d1520] border border-[#1a2744] p-6 hover:border-[#00d4aa]/20 transition-all">
            <div className="text-4xl font-bold text-[#00d4aa] mb-3">220B+</div>
            <div className="text-sm font-medium text-[#e2e8f0] mb-2">
              Lines of COBOL in production
            </div>
            <p className="text-xs text-[#64748b] leading-relaxed">
              More lines of active COBOL exist today than any other programming
              language. Banks, insurers, and governments depend on it daily.
            </p>
          </div>

          <div className="rounded-xl bg-[#0d1520] border border-[#1a2744] p-6 hover:border-[#00d4aa]/20 transition-all">
            <div className="text-4xl font-bold text-[#ff6b6b] mb-3">~60</div>
            <div className="text-sm font-medium text-[#e2e8f0] mb-2">
              Average age of COBOL developers
            </div>
            <p className="text-xs text-[#64748b] leading-relaxed">
              The generation that built these systems is retiring. Universities
              stopped teaching COBOL decades ago. The knowledge gap grows every year.
            </p>
          </div>

          <div className="rounded-xl bg-[#0d1520] border border-[#1a2744] p-6 hover:border-[#00d4aa]/20 transition-all">
            <div className="text-4xl font-bold text-[#ffd93d] mb-3">$100K+</div>
            <div className="text-sm font-medium text-[#e2e8f0] mb-2">
              Typical COBOL engineer salary
            </div>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Demand far outstrips supply. Companies are desperate for developers
              who can maintain and modernize their critical COBOL infrastructure.
            </p>
          </div>
        </div>

        {/* Quote / Callout */}
        <div className="rounded-xl gradient-border bg-[#0d1520] p-8 text-center max-w-3xl mx-auto">
          <p className="text-lg text-[#c8d6e5] leading-relaxed mb-4">
            During the COVID-19 pandemic, state unemployment systems built
            in COBOL crashed under load. New Jersey&apos;s governor{" "}
            <span className="text-[#00d4aa] font-medium">publicly called for COBOL volunteers</span>{" "}
            to come out of retirement to fix them.
          </p>
          <div className="text-sm text-[#64748b]">
            This isn&apos;t a niche skill — it&apos;s a{" "}
            <span className="text-[#00d4aa] font-medium">career opportunity</span>{" "}
            hiding in the most unexpected place.
          </div>
        </div>

        {/* Why AI Learning */}
        <div className="mt-16 text-center">
          <h3 className="text-xl font-semibold mb-4">
            Why learn with <span className="text-[#00d4aa]">AI</span>?
          </h3>
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            <div className="rounded-lg bg-[#111b2e] p-4 text-left">
              <div className="text-sm font-medium text-[#e2e8f0] mb-1">
                Traditional Way
              </div>
              <p className="text-xs text-[#64748b]">
                Read 800-page COBOL manuals. Hope you find a mentor who hasn&apos;t
                retired. Struggle with undocumented enterprise code.
              </p>
            </div>
            <div className="rounded-lg bg-[#00d4aa]/5 border border-[#00d4aa]/20 p-4 text-left">
              <div className="text-sm font-medium text-[#00d4aa] mb-1">
                COBOL Academy Way
              </div>
              <p className="text-xs text-[#94a3b8]">
                Ask questions in plain English. Get explanations with real code
                references. See Python equivalents. Understand business logic
                instantly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
