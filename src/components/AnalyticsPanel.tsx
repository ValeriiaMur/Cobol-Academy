"use client";

import { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from "recharts";

interface SearchResult {
  score: number;
  filePath: string;
  division: string;
  chunkType: string;
  lineStart: number;
  lineEnd: number;
  paragraphName: string;
}

interface QueryLog {
  query: string;
  latencyMs: number;
  resultsCount: number;
  topScore: number;
  timestamp: number;
}

interface AnalyticsPanelProps {
  currentResults: SearchResult[];
  queryHistory: QueryLog[];
  latencyMs: number;
}

const COLORS = ["#00d4aa", "#0088ff", "#ffd93d", "#ff6b6b", "#a78bfa", "#f472b6", "#34d399", "#fb923c"];
const CHART_BG = "#0a0e17";

// Custom tooltip styling
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111b2e] border border-[#1a2744] rounded-lg px-3 py-2 text-xs shadow-lg">
      {label && <div className="text-[#94a3b8] mb-1">{label}</div>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-[#e2e8f0]">
            {entry.name}: <strong>{typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}</strong>
          </span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPanel({
  currentResults,
  queryHistory,
  latencyMs,
}: AnalyticsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  // 1. Chunk Type Distribution (pie)
  const chunkTypeData = useMemo(() => {
    if (!currentResults.length) return [];
    const counts: Record<string, number> = {};
    currentResults.forEach((r) => {
      const type = r.chunkType || "unknown";
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [currentResults]);

  // 2. Division Breakdown (pie)
  const divisionData = useMemo(() => {
    if (!currentResults.length) return [];
    const counts: Record<string, number> = {};
    currentResults.forEach((r) => {
      const div = r.division || "UNKNOWN";
      counts[div] = (counts[div] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [currentResults]);

  // 3. Similarity Score Distribution (bar)
  const scoreData = useMemo(() => {
    if (!currentResults.length) return [];
    return currentResults.map((r, i) => ({
      name: r.paragraphName || r.filePath.split("/").pop() || `Chunk ${i + 1}`,
      score: +(r.score * 100).toFixed(1),
      lines: r.lineEnd - r.lineStart + 1,
    }));
  }, [currentResults]);

  // 4. Query Latency Over Time (area)
  const latencyData = useMemo(() => {
    return queryHistory.map((q, i) => ({
      query: `Q${i + 1}`,
      latency: q.latencyMs,
      topScore: +(q.topScore * 100).toFixed(1),
      results: q.resultsCount,
    }));
  }, [queryHistory]);

  // 5. File Distribution (which files are hit)
  const fileData = useMemo(() => {
    if (!currentResults.length) return [];
    const counts: Record<string, number> = {};
    currentResults.forEach((r) => {
      const file = r.filePath.split("/").pop() || r.filePath;
      counts[file] = (counts[file] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [currentResults]);

  // Average stats
  const avgScore = currentResults.length
    ? (currentResults.reduce((s, r) => s + r.score, 0) / currentResults.length * 100).toFixed(1)
    : "0";

  const avgLatency = queryHistory.length
    ? Math.round(queryHistory.reduce((s, q) => s + q.latencyMs, 0) / queryHistory.length)
    : 0;

  if (!currentResults.length && !queryHistory.length) return null;

  return (
    <div className="max-w-5xl mx-auto mt-8">
      <div className="rounded-xl bg-[#0d1520] border border-[#1a2744] overflow-hidden">
        {/* Toggle Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-5 py-3 flex items-center justify-between hover:bg-[#111b2e]/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-[#00d4aa]">Analytics</span>
            <div className="flex items-center gap-4 text-xs">
              {currentResults.length > 0 && (
                <>
                  <span className="text-[#4a5568]">
                    Avg similarity: <span className="text-[#e2e8f0] font-mono">{avgScore}%</span>
                  </span>
                  <span className="text-[#4a5568]">
                    Files: <span className="text-[#e2e8f0] font-mono">{fileData.length}</span>
                  </span>
                </>
              )}
              {queryHistory.length > 1 && (
                <span className="text-[#4a5568]">
                  Avg latency: <span className="text-[#e2e8f0] font-mono">{avgLatency}ms</span>
                </span>
              )}
              <span className="text-[#4a5568]">
                Queries: <span className="text-[#e2e8f0] font-mono">{queryHistory.length}</span>
              </span>
            </div>
          </div>
          <span className="text-[#4a5568] text-xs">{expanded ? "▲" : "▼"} charts</span>
        </button>

        {/* Charts Grid */}
        {expanded && (
          <div className="border-t border-[#1a2744] p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Similarity Score Distribution */}
              {scoreData.length > 0 && (
                <div className="bg-[#0a0e17] rounded-lg p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-3">
                    Similarity Scores — Current Query
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={scoreData} barSize={20}>
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#4a5568", fontSize: 9 }}
                        axisLine={{ stroke: "#1a2744" }}
                        tickLine={false}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis
                        tick={{ fill: "#4a5568", fontSize: 10 }}
                        axisLine={{ stroke: "#1a2744" }}
                        tickLine={false}
                        domain={[0, 100]}
                        width={35}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="score" name="Score %" radius={[4, 4, 0, 0]}>
                        {scoreData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={i === 0 ? "#00d4aa" : i < 3 ? "#0088ff" : "#1a2744"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Division + Chunk Type Breakdown */}
              {(divisionData.length > 0 || chunkTypeData.length > 0) && (
                <div className="bg-[#0a0e17] rounded-lg p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-3">
                    Codebase Breakdown — Retrieved Chunks
                  </div>
                  <div className="flex items-center justify-around">
                    {/* Division Pie */}
                    {divisionData.length > 0 && (
                      <div className="text-center">
                        <ResponsiveContainer width={120} height={120}>
                          <PieChart>
                            <Pie
                              data={divisionData}
                              cx="50%"
                              cy="50%"
                              outerRadius={50}
                              innerRadius={25}
                              dataKey="value"
                              strokeWidth={0}
                            >
                              {divisionData.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="text-[10px] text-[#64748b] mt-1">Divisions</div>
                        <div className="flex flex-wrap justify-center gap-1 mt-1">
                          {divisionData.map((d, i) => (
                            <span key={d.name} className="flex items-center gap-1 text-[9px] text-[#94a3b8]">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                              {d.name.replace(" DIVISION", "")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chunk Type Pie */}
                    {chunkTypeData.length > 0 && (
                      <div className="text-center">
                        <ResponsiveContainer width={120} height={120}>
                          <PieChart>
                            <Pie
                              data={chunkTypeData}
                              cx="50%"
                              cy="50%"
                              outerRadius={50}
                              innerRadius={25}
                              dataKey="value"
                              strokeWidth={0}
                            >
                              {chunkTypeData.map((_, i) => (
                                <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="text-[10px] text-[#64748b] mt-1">Chunk Types</div>
                        <div className="flex flex-wrap justify-center gap-1 mt-1">
                          {chunkTypeData.map((d, i) => (
                            <span key={d.name} className="flex items-center gap-1 text-[9px] text-[#94a3b8]">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[(i + 3) % COLORS.length] }} />
                              {d.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Query Latency Over Time */}
              {latencyData.length > 1 && (
                <div className="bg-[#0a0e17] rounded-lg p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-3">
                    Query Performance — Session History
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={latencyData}>
                      <CartesianGrid stroke="#1a2744" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="query"
                        tick={{ fill: "#4a5568", fontSize: 10 }}
                        axisLine={{ stroke: "#1a2744" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#4a5568", fontSize: 10 }}
                        axisLine={{ stroke: "#1a2744" }}
                        tickLine={false}
                        width={40}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="latency"
                        name="Latency (ms)"
                        stroke="#00d4aa"
                        fill="#00d4aa"
                        fillOpacity={0.1}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Files Hit Distribution */}
              {fileData.length > 0 && (
                <div className="bg-[#0a0e17] rounded-lg p-4">
                  <div className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-3">
                    Files Retrieved — Current Query
                  </div>
                  <div className="space-y-2">
                    {fileData.map((f, i) => (
                      <div key={f.name} className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-[#94a3b8] w-32 truncate text-right">
                          {f.name}
                        </span>
                        <div className="flex-1 h-3 bg-[#1a2744] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(f.value / Math.max(...fileData.map((d) => d.value))) * 100}%`,
                              background: COLORS[i % COLORS.length],
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-[#e2e8f0] w-4 text-right">
                          {f.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Lines of code covered */}
                  <div className="mt-3 pt-3 border-t border-[#1a2744] flex items-center justify-between text-[10px]">
                    <span className="text-[#4a5568]">Total lines covered</span>
                    <span className="text-[#00d4aa] font-mono">
                      {currentResults.reduce((s, r) => s + (r.lineEnd - r.lineStart + 1), 0)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Session Summary */}
            {queryHistory.length > 0 && (
              <div className="mt-4 bg-[#0a0e17] rounded-lg p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#4a5568] mb-2">
                  Session Query Log
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {queryHistory.map((q, i) => (
                    <div key={i} className="flex items-center gap-3 text-[10px]">
                      <span className="text-[#4a5568] font-mono w-6">Q{i + 1}</span>
                      <span className="text-[#94a3b8] flex-1 truncate">{q.query}</span>
                      <span className="text-[#00d4aa] font-mono w-12 text-right">
                        {(q.topScore * 100).toFixed(0)}%
                      </span>
                      <span className="text-[#64748b] font-mono w-14 text-right">
                        {q.latencyMs}ms
                      </span>
                      <span className="text-[#4a5568] font-mono w-10 text-right">
                        {q.resultsCount} hits
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
