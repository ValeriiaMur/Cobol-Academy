/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["langchain", "@langchain/openai", "@langchain/pinecone"],
  },
};

export default nextConfig;
