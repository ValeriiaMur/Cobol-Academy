# COBOL Academy

**Understand the language that quietly runs the world.**

COBOL Academy is an AI-powered learning platform that helps developers understand COBOL through guided exploration of the GnuCOBOL compiler source code. Built with RAG (Retrieval-Augmented Generation), it lets you ask questions in plain English and get answers grounded in real code — with file paths, line numbers, and modern language equivalents.

> COBOL powers 95% of ATM transactions, 80% of in-person transactions, and $3 trillion in daily commerce. The engineers who built these systems are retiring. The code isn't.

---

## Architecture Overview

```
User Query (Natural Language)
       |
       v
OpenAI text-embedding-3-small ──> 1536-dim vector
       |
       v
Pinecone Vector Search ──> Top-5 cosine similarity + metadata filtering
       |
       v
Context Assembly ──> Code chunks + file paths + line numbers + dependencies
       |
       v
GPT-4o-mini (streaming) ──> Educational answer with code references
       |
       v
Next.js Frontend ──> Code display + AI explanation + relevance scores
```

### Technical Stack

| Layer | Technology | Version/Tier |
|-------|-----------|-------------|
| Target Codebase | GnuCOBOL | 200K+ LOC, 300+ files |
| Vector Database | Pinecone | Free tier (Starter), managed cloud |
| Embeddings | OpenAI text-embedding-3-small | 1536 dimensions |
| LLM | GPT-4o-mini | 128K context window |
| RAG Framework | LangChain-compatible | Custom pipeline |
| Chunking | Custom COBOL-aware splitter | Paragraph-level + fixed fallback |
| Backend | Next.js API Routes | App Router |
| Frontend | Next.js + React + Tailwind CSS | v14 |
| Deployment | Vercel | Free tier (Hobby) |
| Evaluation | Manual test suite + RAGAS | Dual approach |

### Chunking Strategy

COBOL has natural **PARAGRAPH** boundaries that serve as perfect semantic units. Each paragraph is a named block of procedural logic. Our chunker exploits this:

1. **PROCEDURE DIVISION** — Splits on COBOL paragraph boundaries (named blocks ending with `.`)
2. **DATA/ENVIRONMENT DIVISION** — Falls back to fixed-size chunking (40 lines, 5-line overlap)
3. **Metadata preserved per chunk:** file path, line numbers (start/end), paragraph name, section name, division name, COPY dependencies, PERFORM targets

This approach produces semantically meaningful chunks aligned with code structure, ideal for queries like "What does CALCULATE-INTEREST do?"

### Retrieval Pipeline

| Stage | Implementation | Notes |
|-------|---------------|-------|
| Query Processing | Natural language input | Extract intent from user question |
| Embedding | OpenAI text-embedding-3-small | Same model as ingestion (critical!) |
| Similarity Search | Pinecone top-5 cosine | With metadata filtering by file type |
| Re-ranking | None (v1) | Can add Cohere re-ranker in v2 |
| Context Assembly | Concatenate chunks + metadata | Include file path and line numbers |
| Answer Generation | GPT-4o-mini with streaming | Custom COBOL teaching prompt |

---

## Quick Start

### Prerequisites

- Node.js 18+
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- Pinecone account ([free tier](https://app.pinecone.io))

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd cobol-academy
npm install --legacy-peer-deps
```

### 2. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your API keys:

```
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX=cobol-academy
```

### 3. Run Ingestion Pipeline

This clones GnuCOBOL, discovers all COBOL files, chunks them with the COBOL-aware splitter, generates embeddings, and stores vectors in Pinecone:

```bash
npm run ingest
```

The script will:
- Clone GnuCOBOL repository (~200K+ LOC)
- Discover 60+ COBOL source files (.cob, .cbl, .cpy)
- Generate ~60 chunks using paragraph-level splitting
- Create 1536-dim embeddings via OpenAI
- Upsert all vectors to Pinecone with metadata
- Complete in ~30 seconds

### 4. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Vercel

```bash
npx vercel --prod
```

Add environment variables (`OPENAI_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX`) in the Vercel dashboard under Settings > Environment Variables.

---

## MVP Requirements Checklist

**Hard gate.** All items required to pass:

- [x] **Ingest at least one legacy codebase** — GnuCOBOL (COBOL), cloned via `scripts/ingest.ts`
- [x] **Chunk code files with syntax-aware splitting** — Custom COBOL paragraph-level chunker in `src/lib/cobol-chunker.ts`
- [x] **Generate embeddings for all chunks** — OpenAI text-embedding-3-small (1536 dims) via `src/lib/embeddings.ts`
- [x] **Store embeddings in a vector database** — Pinecone (managed cloud, free tier) via `src/lib/pinecone.ts`
- [x] **Implement semantic search across the codebase** — Top-5 cosine similarity via `/api/search`
- [x] **Natural language query interface** — Next.js web app with search bar, suggested queries, streaming results
- [x] **Return relevant code snippets with file/line references** — Expandable results with line numbers, division, section, paragraph metadata
- [x] **Basic answer generation using retrieved context** — GPT-4o-mini with SSE streaming via `/api/answer`
- [x] **Deployed and publicly accessible** — Vercel with `vercel.json` config

## Query Interface Features

| Feature | Status | Implementation |
|---------|--------|---------------|
| Natural language input | Done | Search bar with Enter key + button |
| Code snippets display | Done | Monospace code blocks with line numbers |
| File paths and line numbers | Done | Shown per result with L{start}-{end} |
| Confidence/relevance scores | Done | Percentage + color-coded score bars |
| Generated explanation from LLM | Done | Streaming AI answer panel |
| Drill down into context | Done | Expandable chunks with dependencies + section info |

## Code Understanding Features (4 of 8 implemented)

| Feature | Description | How It Works |
|---------|------------|-------------|
| **Code Explanation** | Explain what a function/section does in plain English | System prompt instructs LLM to explain COBOL code clearly with line references |
| **Translation Hints** | Suggest modern language equivalents | LLM provides Python/JS equivalents for COBOL constructs (e.g., PERFORM VARYING = for loop) |
| **Pattern Detection** | Find similar code patterns across the codebase | Semantic search naturally groups similar patterns (file I/O, error handling, etc.) |
| **Business Logic Extract** | Identify and explain business rules in code | System prompt highlights business rules embedded in procedural code |

---

## Live Stats Dashboard

The app includes a real-time stats panel (visible after clicking "Start Exploring COBOL") that shows:

- **Total vectors** stored in Pinecone
- **Embedding dimensions** (1536)
- **Index metric** (cosine similarity)
- **Namespace breakdown** with visual bars
- **Index fullness** percentage
- **RAG pipeline config** (models, top-k, chunking strategy)

Per-query stats are also shown: retrieval latency, top similarity score, unique files hit, and COBOL divisions covered.

---

## Project Structure

```
cobol-academy/
├── scripts/
│   └── ingest.ts              # Ingestion pipeline (clone, chunk, embed, store)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── answer/route.ts  # RAG answer generation (SSE streaming)
│   │   │   ├── search/route.ts  # Semantic search endpoint
│   │   │   └── stats/route.ts   # Live Pinecone index stats
│   │   ├── globals.css          # Tailwind + custom styles
│   │   ├── layout.tsx           # Root layout with metadata
│   │   └── page.tsx             # Main page composition
│   ├── components/
│   │   ├── Hero.tsx             # Landing hero with typewriter demo
│   │   ├── QueryInterface.tsx   # Search + results + streaming answer
│   │   ├── StatsBar.tsx         # Live vector/index stats dashboard
│   │   ├── CrisisSection.tsx    # COBOL crisis narrative
│   │   ├── FeaturesSection.tsx  # Feature cards + RAG pipeline viz
│   │   └── Footer.tsx           # Footer with project attribution
│   └── lib/
│       ├── cobol-chunker.ts     # COBOL-aware syntax splitter
│       ├── embeddings.ts        # OpenAI embedding generation
│       ├── pinecone.ts          # Pinecone client (upsert + query)
│       └── rag-pipeline.ts      # Search + context assembly + LLM
├── .env.local.example           # Environment template
├── next.config.mjs              # Next.js configuration
├── tailwind.config.ts           # Tailwind with custom COBOL theme
├── vercel.json                  # Vercel deployment config
└── package.json                 # Dependencies and scripts
```

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Query latency | <3 seconds end-to-end | ~1-2s search + streaming |
| Retrieval precision | >70% relevant in top-5 | Validated with test queries |
| Codebase coverage | 100% of files indexed | All .cob/.cbl/.cpy files |
| Ingestion throughput | 10K+ LOC in <5 minutes | ~30s for full ingestion |
| Answer accuracy | Correct file/line references | LLM cites exact paths + lines |

## Testing Scenarios

These queries from the project spec are supported:

1. "Where is the main entry point of this program?"
2. "What functions modify the CUSTOMER-RECORD?"
3. "Explain what the CALCULATE-INTEREST paragraph does"
4. "Find all file I/O operations"
5. "What are the dependencies of MODULE-X?"
6. "Show me error handling patterns in this codebase"

---

## AI Cost Analysis

### Development Costs

| Cost Category | Estimated Cost | Provider |
|--------------|---------------|----------|
| Embedding API | ~$2-5 (one-time ingestion) | OpenAI text-embedding-3-small |
| LLM API (dev + testing) | ~$3-8 | GPT-4o-mini |
| Vector DB hosting | $0 (free tier) | Pinecone |
| Web hosting | $0 (free tier) | Vercel |
| **Total Development** | **~$5-15** | |

### Production Cost Projections

| Component | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|-----------|-----------|-------------|-------------|--------------|
| Embedding API | $0.50/mo | $0.50/mo | $1/mo | $2/mo |
| LLM API (GPT-4o-mini) | $2/mo | $20/mo | $200/mo | $2,000/mo |
| Pinecone | $0 (free) | $70/mo | $70/mo | $200/mo |
| Vercel hosting | $0 (free) | $20/mo | $20/mo | $100/mo |
| **Total Estimated** | **~$3/mo** | **~$111/mo** | **~$291/mo** | **~$2,302/mo** |

*Assumptions: 5 queries/user/day, ~2K tokens per query (embedding + LLM), monthly re-embedding for code updates.*

---

## Failure Mode Handling

| Failure Mode | Strategy |
|-------------|----------|
| No relevant results found | Graceful message + suggest related queries + offer to browse codebase |
| Ambiguous query | Show multiple interpretation options in results |
| Very long COBOL paragraphs | Truncate to embedding model max tokens with overlap |
| Rate limiting (OpenAI) | Exponential backoff with retry in batch embedding |
| Pinecone downtime | Error message with suggestion to retry |
| Hallucinated line numbers | Metadata from Pinecone ensures real line refs |
| Non-COBOL queries | System prompt redirects to COBOL-related suggestions |

---

## Gauntlet AI — Week 3: LegacyLens

This project was built for the Gauntlet AI Week 3 sprint, focused on building RAG systems for legacy enterprise codebases.

### Submission Deliverables

| Deliverable | Status |
|------------|--------|
| GitHub Repository | This repo (setup guide + architecture + deployed link) |
| Demo Video (3-5 min) | Record queries, retrieval results, answer generation |
| Pre-Search Document | Completed (LegacyLens_PreSearch.pdf) |
| RAG Architecture Doc | See Architecture Overview + Pre-Search doc |
| AI Cost Analysis | See Cost Analysis section above |
| Deployed Application | Vercel deployment |
| Social Post | Share on X/LinkedIn with demo screenshots |

## License

MIT
