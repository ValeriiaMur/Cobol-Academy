import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COBOL Academy | Understand the Language That Quietly Runs the World",
  description:
    "AI-powered learning platform that helps developers understand COBOL — the language behind 95% of ATM transactions, 80% of in-person transactions, and $3 trillion in daily commerce. Learn with real code from GnuCOBOL, powered by RAG.",
  keywords: [
    "COBOL",
    "learn COBOL",
    "legacy code",
    "COBOL training",
    "mainframe",
    "GnuCOBOL",
    "AI learning",
    "RAG",
    "code understanding",
  ],
  openGraph: {
    title: "COBOL Academy",
    description: "Understand the language that quietly runs the world",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="matrix-bg min-h-screen antialiased">{children}</body>
    </html>
  );
}
