/**
 * API Route: /api/logs
 *
 * Returns session query log and aggregate metrics.
 * Useful for debugging, analytics, and evaluation.
 */

import { NextResponse } from "next/server";
import { getSessionLog, getSessionMetrics } from "@/lib/query-logger";

export async function GET() {
  return NextResponse.json({
    metrics: getSessionMetrics(),
    log: getSessionLog(),
  });
}
