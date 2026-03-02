"use client";

import { useState } from "react";
import Hero from "@/components/Hero";
import StatsBar from "@/components/StatsBar";
import QueryInterface from "@/components/QueryInterface";
import CrisisSection from "@/components/CrisisSection";
import FeaturesSection from "@/components/FeaturesSection";
import Footer from "@/components/Footer";

export default function Home() {
  const [showQuery, setShowQuery] = useState(false);

  return (
    <main className="min-h-screen">
      <Hero onStartLearning={() => setShowQuery(true)} />

      {showQuery && (
        <section id="query" className="py-12">
          <StatsBar />
          <QueryInterface />
        </section>
      )}

      <CrisisSection />
      <FeaturesSection />
      <Footer />
    </main>
  );
}
