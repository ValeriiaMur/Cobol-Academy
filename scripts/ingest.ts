/**
 * COBOL Academy - Ingestion Pipeline
 *
 * This script:
 * 1. Clones the GnuCOBOL repository (or uses local copy)
 * 2. Discovers all COBOL source files (.cob, .cbl, .cpy)
 * 3. Chunks them using COBOL-aware paragraph splitting
 * 4. Generates embeddings via OpenAI
 * 5. Stores vectors in Pinecone with metadata
 *
 * Usage: npx tsx scripts/ingest.ts
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { chunkCobolFile, formatChunkForEmbedding, CobolChunk } from "../src/lib/cobol-chunker";
import { generateEmbeddings } from "../src/lib/embeddings";
import { upsertVectors, VectorMetadata, getPineconeClient } from "../src/lib/pinecone";

// Load environment variables
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const COBOL_EXTENSIONS = [".cob", ".cbl", ".cpy", ".CBL", ".COB"];
const REPO_URL = "https://github.com/OCamlPro/gnucobol.git";
const LOCAL_DIR = "./cobol-codebase";
const MIN_CHUNK_LENGTH = 20; // characters - skip tiny chunks

/**
 * Step 1: Clone or update the GnuCOBOL repository
 */
function cloneRepository(): string {
  const repoDir = path.resolve(LOCAL_DIR);

  if (fs.existsSync(repoDir)) {
    console.log("📁 Repository already exists, using local copy...");
    return repoDir;
  }

  console.log("📥 Cloning GnuCOBOL repository...");
  execSync(`git clone --depth 1 ${REPO_URL} ${repoDir}`, {
    stdio: "inherit",
  });
  console.log("✅ Clone complete!");
  return repoDir;
}

/**
 * Step 2: Discover all COBOL source files
 */
function discoverCobolFiles(rootDir: string): string[] {
  const cobolFiles: string[] = [];

  function walk(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (COBOL_EXTENSIONS.includes(ext)) {
            cobolFiles.push(fullPath);
          }
        }
      }
    } catch (e) {
      // Skip directories we can't read
    }
  }

  walk(rootDir);
  return cobolFiles;
}

/**
 * Step 3: Read and chunk all files
 */
function processFiles(files: string[], rootDir: string): CobolChunk[] {
  const allChunks: CobolChunk[] = [];
  let totalLines = 0;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(rootDir, file);
      const lines = content.split("\n").length;
      totalLines += lines;

      const chunks = chunkCobolFile(content, relativePath);
      // Filter out tiny chunks
      const validChunks = chunks.filter((c) => c.content.trim().length >= MIN_CHUNK_LENGTH);
      allChunks.push(...validChunks);

      console.log(`  📄 ${relativePath}: ${lines} lines → ${validChunks.length} chunks`);
    } catch (e) {
      console.warn(`  ⚠️ Skipping ${file}: ${e}`);
    }
  }

  console.log(`\n📊 Total: ${files.length} files, ${totalLines} lines, ${allChunks.length} chunks`);
  return allChunks;
}

/**
 * Step 4 & 5: Embed and store
 */
async function embedAndStore(chunks: CobolChunk[]) {
  // Format chunks for embedding
  const texts = chunks.map(formatChunkForEmbedding);

  console.log("\n🧠 Generating embeddings...");
  const startEmbed = Date.now();
  const embeddings = await generateEmbeddings(texts);
  const embedTime = ((Date.now() - startEmbed) / 1000).toFixed(1);
  console.log(`✅ Generated ${embeddings.length} embeddings in ${embedTime}s`);

  // Prepare vectors for Pinecone
  const vectors = chunks.map((chunk, i) => ({
    id: `${chunk.metadata.filePath}:${chunk.metadata.lineStart}-${chunk.metadata.lineEnd}`,
    values: embeddings[i],
    metadata: {
      filePath: chunk.metadata.filePath,
      lineStart: chunk.metadata.lineStart,
      lineEnd: chunk.metadata.lineEnd,
      division: chunk.metadata.division,
      section: chunk.metadata.section,
      paragraphName: chunk.metadata.paragraphName,
      chunkType: chunk.metadata.chunkType,
      dependencies: chunk.metadata.dependencies.join(","),
      content: chunk.content.substring(0, 3500), // Pinecone metadata limit ~40KB
    } as VectorMetadata,
  }));

  console.log("\n📤 Upserting to Pinecone...");
  const startUpsert = Date.now();
  await upsertVectors(vectors);
  const upsertTime = ((Date.now() - startUpsert) / 1000).toFixed(1);
  console.log(`✅ Upserted ${vectors.length} vectors in ${upsertTime}s`);
}

/**
 * Ensure Pinecone index exists
 */
async function ensureIndex() {
  const client = getPineconeClient();
  const indexName = process.env.PINECONE_INDEX || "cobol-academy";

  const indexes = await client.listIndexes();
  const indexNames = indexes?.indexes?.map((idx) => idx.name) || [];

  if (!indexNames.includes(indexName)) {
    console.log(`🔧 Creating Pinecone index "${indexName}"...`);
    await client.createIndex({
      name: indexName,
      dimension: 1536, // text-embedding-3-small
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });
    // Wait for index to be ready
    console.log("⏳ Waiting for index to be ready...");
    await new Promise((resolve) => setTimeout(resolve, 30000));
    console.log("✅ Index created!");
  } else {
    console.log(`✅ Index "${indexName}" already exists`);
  }
}

/**
 * Main ingestion pipeline
 */
async function main() {
  console.log("🎓 COBOL Academy - Ingestion Pipeline");
  console.log("=====================================\n");

  const startTime = Date.now();

  // Step 1: Get the codebase
  const repoDir = cloneRepository();

  // Step 2: Find COBOL files
  console.log("\n🔍 Discovering COBOL files...");
  const files = discoverCobolFiles(repoDir);
  console.log(`Found ${files.length} COBOL files\n`);

  if (files.length === 0) {
    console.error("❌ No COBOL files found! Check the repository path.");
    process.exit(1);
  }

  // Step 3: Process and chunk
  console.log("✂️ Chunking with COBOL-aware splitter...");
  const chunks = processFiles(files, repoDir);

  // Step 4: Ensure Pinecone index exists
  await ensureIndex();

  // Step 5: Embed and store
  await embedAndStore(chunks);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 Ingestion complete in ${totalTime}s!`);
  console.log(`   Files: ${files.length}`);
  console.log(`   Chunks: ${chunks.length}`);
  console.log(`   Index: ${process.env.PINECONE_INDEX || "cobol-academy"}`);
}

main().catch((error) => {
  console.error("❌ Ingestion failed:", error);
  process.exit(1);
});
