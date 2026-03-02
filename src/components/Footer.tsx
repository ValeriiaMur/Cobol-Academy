"use client";

export default function Footer() {
  return (
    <footer className="px-4 py-12 border-t border-[#1a2744]">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#00d4aa] to-[#0088ff] flex items-center justify-center">
              <span className="text-[#0a0e17] font-bold text-[10px] font-mono">{`>`}_</span>
            </div>
            <span className="text-sm font-medium">
              COBOL <span className="text-[#00d4aa]">Academy</span>
            </span>
          </div>

          <p className="text-xs text-[#4a5568] text-center">
            Built for{" "}
            <span className="text-[#64748b]">Gauntlet AI — Week 3: LegacyLens</span>
            {" · "}
            RAG-powered COBOL learning platform
          </p>

          <div className="flex items-center gap-4 text-xs text-[#4a5568]">
            <span>Next.js + Pinecone + OpenAI</span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00d4aa] hover:underline"
            >
              Source Code
            </a>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-[10px] text-[#2d3748]">
            Understand the language that quietly runs the world.
          </p>
        </div>
      </div>
    </footer>
  );
}
