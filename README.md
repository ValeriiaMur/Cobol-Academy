# 🎓 COBOL Academy

**Understand the language that quietly runs the world.**

COBOL Academy is an AI-powered learning platform that helps developers understand COBOL through guided exploration of the GnuCOBOL compiler source code. Built with RAG (Retrieval-Augmented Generation), it lets you ask questions in plain English and get answers grounded in real code.

> 🏦 COBOL powers 95% of ATM transactions, 80% of in-person transactions, and $3 trillion in daily commerce. The engineers who built these systems are retiring. The code isn't.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    COBOL Academy                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   User Query (Natural Language)                              │
│       │                                                      │
│       ▼                                                      │
│   OpenAI text-embedding-3-small (1536 dims)                  │
│       │                                                      │
│       ▼                                                      │
│   Pinecone Vector Search (Top-5 cosine similarity)           │
│       │                                                      │
│       ▼                                                      │
│   Context Assembly (code + metadata + file refs)             │
│       │                                                      │
│       ▼                                                      │
│   GPT-4o-mini (streaming response)                           │
│       │                                                      │
│       ▼                                                      │
│   Next.js Frontend (code display + AI explanation)           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Technical Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Target Codebase | GnuCOBOL | 200K+ LOC, 300+ files |
| Vector Database | Pinecone | Managed cloud, free tier |
| Embeddings | OpenAI text-embedding-3-small | 1536 dimensions |
| LLM | GPT-4o-mini | 128K context, streaming |
| Chunking | Custom COBOL-aware splitter | Paragraph-level + fixed fallback |
| Frontend | Next.js + Tailwind CSS | App Router |
| Deployment | Vercel | Free tier (Hobby) |

### Chunking Strategy

COBOL has natural **PARAGRAPH** boundaries that serve as semantic units. Our chunker:
1. Splits on COBOL paragraph boundaries in the PROCEDURE DIVISION
2. Falls back to fixed-size (40 lines, 5-line overlap) for DATA/ENVIRONMENT divisions
3. Preserves metadata: file path, line numbers, division, section, paragraph name, dependencies

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- OpenAI API key
- Pinecone account (free tier works)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd cobol-academy
npm install --legacy-peer-deps
```

### 2. Configure Environment

```bash
cp .env.local.example .env.local
# Edit .env.local with your API keys:
#   OPENAI_API_KEY=sk-...
#   PINECONE_API_KEY=pcsk_...
#   PINECONE_INDEX=cobol-academy
```

### 3. Run Ingestion Pipeline

This clones GnuCOBOL, chunks all COBOL files, generates embeddings, and stores them in Pinecone:

```bash
npm run ingest
```

Expected output:
- ~300+ COBOL files discovered
- ~2000+ chunks generated
- ~5 minutes for full ingestion

### 4. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

### 5. Deploy to Vercel

```bash
npx vercel --prod
# Add environment variables in Vercel dashboard
```

## 📋 MVP Requirements Checklist

- [x] Ingest at least one legacy codebase (GnuCOBOL - COBOL)
- [x] Chunk code files with syntax-aware splitting (COBOL paragraph-level)
- [x] Generate embeddings for all chunks (OpenAI text-embedding-3-small)
- [x] Store embeddings in a vector database (Pinecone)
- [x] Implement semantic search across the codebase (cosine similarity, top-5)
- [x] Natural language query interface (Next.js web app)
- [x] Return relevant code snippets with file/line references
- [x] Basic answer generation using retrieved context (GPT-4o-mini streaming)
- [x] Deployed and publicly accessible (Vercel)

## 🧠 Code Understanding Features (4 implemented)

1. **Code Explanation** — Ask about any function/paragraph, get plain English explanations
2. **Translation Hints** — See Python equivalents for COBOL constructs
3. **Pattern Detection** — Find similar code patterns across the codebase
4. **Business Logic Extraction** — Identify business rules embedded in code

## 🔍 Example Queries

- "Where is the main entry point of this program?"
- "What functions modify CUSTOMER-RECORD?"
- "Explain what the CALCULATE-INTEREST paragraph does"
- "Find all file I/O operations"
- "Show me error handling patterns in this codebase"
- "What are the dependencies of MODULE-X?"

## 📊 Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Query latency | <3 seconds | ✅ |
| Retrieval precision | >70% relevant in top-5 | ✅ |
| Codebase coverage | 100% files indexed | ✅ |
| Ingestion throughput | 10K+ LOC in <5 min | ✅ |

## 🏛️ Project Context

Built for **Gauntlet AI — Week 3: LegacyLens** project. This is a one-week sprint building a RAG system for legacy enterprise codebases, with a focus on making COBOL queryable and understandable through natural language.

## 📄 License

MIT
