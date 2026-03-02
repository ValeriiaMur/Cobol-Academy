"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface SearchResult {
  id: string;
  score: number;
  content: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  division: string;
  section: string;
  paragraphName: string;
  chunkType: string;
  dependencies: string[];
}

interface GraphNode {
  id: string;
  label: string;
  type: "paragraph" | "copybook" | "program" | "file";
  filePath: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string;
  target: string;
  type: "PERFORM" | "COPY" | "CALL";
}

interface DependencyGraphProps {
  results: SearchResult[];
  onNodeClick?: (filePath: string, paragraphName: string) => void;
}

export default function DependencyGraph({ results, onNodeClick }: DependencyGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const dragNodeRef = useRef<GraphNode | null>(null);
  const animFrameRef = useRef<number>(0);

  // Build graph data from search results
  const buildGraph = useCallback(() => {
    const nodeMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    for (const result of results) {
      // Add the result as a node
      const nodeId = result.paragraphName || result.filePath.split("/").pop() || result.id;
      if (!nodeMap.has(nodeId)) {
        const fileName = result.filePath.split("/").pop() || "";
        nodeMap.set(nodeId, {
          id: nodeId,
          label: result.paragraphName || fileName,
          type: result.paragraphName
            ? "paragraph"
            : fileName.endsWith(".cpy")
            ? "copybook"
            : "file",
          filePath: result.filePath,
          x: Math.random() * 400 + 100,
          y: Math.random() * 250 + 50,
          vx: 0,
          vy: 0,
        });
      }

      // Add dependency nodes and links
      for (const dep of result.dependencies) {
        const [type, target] = dep.split(":");
        if (!target) continue;

        const targetId = target.toUpperCase();
        if (!nodeMap.has(targetId)) {
          nodeMap.set(targetId, {
            id: targetId,
            label: target,
            type:
              type === "COPY"
                ? "copybook"
                : type === "CALL"
                ? "program"
                : "paragraph",
            filePath: "",
            x: Math.random() * 400 + 100,
            y: Math.random() * 250 + 50,
            vx: 0,
            vy: 0,
          });
        }

        links.push({
          source: nodeId,
          target: targetId,
          type: type as "PERFORM" | "COPY" | "CALL",
        });
      }
    }

    // Also add file-level nodes for unique files
    const files = new Set(results.map((r) => r.filePath));
    for (const f of files) {
      const fileName = f.split("/").pop() || f;
      if (!nodeMap.has(fileName)) {
        nodeMap.set(fileName, {
          id: fileName,
          label: fileName,
          type: fileName.endsWith(".cpy") ? "copybook" : "file",
          filePath: f,
          x: Math.random() * 400 + 100,
          y: Math.random() * 250 + 50,
          vx: 0,
          vy: 0,
        });
      }
    }

    nodesRef.current = Array.from(nodeMap.values());
    linksRef.current = links;
  }, [results]);

  // Simple force simulation
  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const links = linksRef.current;
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const centerX = W / 2;
    const centerY = H / 2;

    // Forces
    const repulsion = 2500;
    const attraction = 0.005;
    const centerGravity = 0.01;
    const damping = 0.85;

    // Apply forces
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].fx != null) continue;

      let fx = 0;
      let fy = 0;

      // Repulsion from other nodes
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = repulsion / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }

      // Attraction along links
      for (const link of links) {
        const isSource = link.source === nodes[i].id;
        const isTarget = link.target === nodes[i].id;
        if (!isSource && !isTarget) continue;

        const otherId = isSource ? link.target : link.source;
        const other = nodes.find((n) => n.id === otherId);
        if (!other) continue;

        const dx = other.x - nodes[i].x;
        const dy = other.y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        fx += dx * attraction;
        fy += dy * attraction;
      }

      // Center gravity
      fx += (centerX - nodes[i].x) * centerGravity;
      fy += (centerY - nodes[i].y) * centerGravity;

      nodes[i].vx = (nodes[i].vx + fx) * damping;
      nodes[i].vy = (nodes[i].vy + fy) * damping;
      nodes[i].x = Math.max(40, Math.min(W - 40, nodes[i].x + nodes[i].vx));
      nodes[i].y = Math.max(30, Math.min(H - 30, nodes[i].y + nodes[i].vy));
    }

    // Draw
    ctx.clearRect(0, 0, W, H);

    // Draw links
    for (const link of links) {
      const source = nodes.find((n) => n.id === link.source);
      const target = nodes.find((n) => n.id === link.target);
      if (!source || !target) continue;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      ctx.strokeStyle =
        link.type === "PERFORM"
          ? "rgba(244, 114, 182, 0.4)"
          : link.type === "COPY"
          ? "rgba(103, 232, 249, 0.4)"
          : "rgba(251, 191, 36, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Arrow
      const angle = Math.atan2(target.y - source.y, target.x - source.x);
      const arrowLen = 8;
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(
        midX - arrowLen * Math.cos(angle - 0.4),
        midY - arrowLen * Math.sin(angle - 0.4)
      );
      ctx.moveTo(midX, midY);
      ctx.lineTo(
        midX - arrowLen * Math.cos(angle + 0.4),
        midY - arrowLen * Math.sin(angle + 0.4)
      );
      ctx.stroke();

      // Link label
      ctx.font = "9px monospace";
      ctx.fillStyle = "rgba(100, 116, 139, 0.6)";
      ctx.fillText(link.type, midX + 5, midY - 5);
    }

    // Draw nodes
    for (const node of nodes) {
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;
      const radius =
        node.type === "file" ? 18 : node.type === "copybook" ? 14 : node.type === "program" ? 16 : 12;

      // Glow for hovered/selected
      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 212, 170, 0.15)";
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle =
        node.type === "file"
          ? "#162038"
          : node.type === "copybook"
          ? "#1a1a3a"
          : node.type === "program"
          ? "#1a2a1a"
          : "#0d1520";
      ctx.fill();
      ctx.strokeStyle =
        isHovered || isSelected
          ? "#00d4aa"
          : node.type === "file"
          ? "#818cf8"
          : node.type === "copybook"
          ? "#67e8f9"
          : node.type === "program"
          ? "#fbbf24"
          : "#4a5568";
      ctx.lineWidth = isHovered || isSelected ? 2 : 1.5;
      ctx.stroke();

      // Node icon/text
      ctx.font = node.type === "file" ? "11px monospace" : "9px monospace";
      ctx.fillStyle =
        node.type === "file"
          ? "#818cf8"
          : node.type === "copybook"
          ? "#67e8f9"
          : node.type === "program"
          ? "#fbbf24"
          : "#94a3b8";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const icon =
        node.type === "file" ? "📄" : node.type === "copybook" ? "📋" : node.type === "program" ? "⚡" : "◆";
      ctx.fillText(icon, node.x, node.y);

      // Label below
      ctx.font = "10px sans-serif";
      ctx.fillStyle = isHovered || isSelected ? "#e2e8f0" : "#64748b";
      const label = node.label.length > 16 ? node.label.substring(0, 14) + "..." : node.label;
      ctx.fillText(label, node.x, node.y + radius + 12);
    }

    animFrameRef.current = requestAnimationFrame(simulate);
  }, [hoveredNode, selectedNode]);

  // Handle mouse events
  const findNodeAt = useCallback((x: number, y: number): GraphNode | null => {
    for (const node of nodesRef.current) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy < 400) return node; // radius ~20
    }
    return null;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);

      if (dragNodeRef.current) {
        dragNodeRef.current.fx = x;
        dragNodeRef.current.fy = y;
        dragNodeRef.current.x = x;
        dragNodeRef.current.y = y;
        return;
      }

      const node = findNodeAt(x, y);
      setHoveredNode(node);
      canvas.style.cursor = node ? "pointer" : "default";
    },
    [findNodeAt]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);

      const node = findNodeAt(x, y);
      if (node) {
        dragNodeRef.current = node;
        node.fx = node.x;
        node.fy = node.y;
      }
    },
    [findNodeAt]
  );

  const handleMouseUp = useCallback(() => {
    if (dragNodeRef.current) {
      const node = dragNodeRef.current;
      // If barely moved, treat as click
      if (node.fx !== null && node.fy !== null) {
        setSelectedNode((prev) => (prev?.id === node.id ? null : node));
        if (onNodeClick) {
          onNodeClick(node.filePath, node.label);
        }
      }
      node.fx = null;
      node.fy = null;
      dragNodeRef.current = null;
    }
  }, [onNodeClick]);

  useEffect(() => {
    buildGraph();
  }, [buildGraph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    canvas.width = container.clientWidth;
    canvas.height = 350;

    animFrameRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [simulate]);

  if (results.length === 0) return null;

  // Collect all dependency types for legend
  const depTypes = new Set<string>();
  for (const r of results) {
    for (const d of r.dependencies) {
      const type = d.split(":")[0];
      if (type) depTypes.add(type);
    }
  }

  return (
    <div className="mt-6 border border-[#1a2744] rounded-xl overflow-hidden bg-[#0a0e17]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0d1520] border-b border-[#1a2744]">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#00d4aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="text-xs font-medium text-[#e2e8f0]">Dependency Graph</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a2744] text-[#64748b]">
            {nodesRef.current.length} nodes · {linksRef.current.length} links
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#818cf8]" />
            <span className="text-[#64748b]">File</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#67e8f9]" />
            <span className="text-[#64748b]">Copybook</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#fbbf24]" />
            <span className="text-[#64748b]">Program</span>
          </span>
          {depTypes.has("PERFORM") && (
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-[#f472b6]" />
              <span className="text-[#64748b]">PERFORM</span>
            </span>
          )}
          {depTypes.has("COPY") && (
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-[#67e8f9]" />
              <span className="text-[#64748b]">COPY</span>
            </span>
          )}
          {depTypes.has("CALL") && (
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-[#fbbf24]" />
              <span className="text-[#64748b]">CALL</span>
            </span>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: 350 }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Hovered node tooltip */}
        {hoveredNode && !dragNodeRef.current && (
          <div className="absolute top-2 right-2 bg-[#0d1520] border border-[#1a2744] rounded-lg px-3 py-2 text-xs max-w-[200px]">
            <div className="font-mono text-[#e2e8f0] font-medium">{hoveredNode.label}</div>
            <div className="text-[#4a5568] mt-0.5">
              {hoveredNode.type} {hoveredNode.filePath && `· ${hoveredNode.filePath.split("/").pop()}`}
            </div>
            <div className="text-[#4a5568] mt-1 text-[10px]">Click to select · Drag to move</div>
          </div>
        )}
      </div>

      {/* Selected node detail */}
      {selectedNode && (
        <div className="px-4 py-2 bg-[#0d1520] border-t border-[#1a2744] flex items-center justify-between">
          <div className="text-xs">
            <span className="text-[#00d4aa] font-mono font-medium">{selectedNode.label}</span>
            <span className="text-[#4a5568] ml-2">{selectedNode.type}</span>
            {selectedNode.filePath && (
              <span className="text-[#4a5568] ml-2">· {selectedNode.filePath}</span>
            )}
          </div>
          <div className="text-[10px] text-[#4a5568]">
            {linksRef.current.filter((l) => l.source === selectedNode.id).length} outgoing ·{" "}
            {linksRef.current.filter((l) => l.target === selectedNode.id).length} incoming
          </div>
        </div>
      )}
    </div>
  );
}
