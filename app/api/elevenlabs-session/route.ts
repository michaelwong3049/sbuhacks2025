/**
 * Next.js API Route for ElevenLabs Session Management
 *
 * SECURITY NOTE: Unfortunately, the ElevenLabs SDK requires the API key in the browser
 * to establish the WebSocket connection. This is a limitation of their SDK design.
 *
 * This route provides the API key with security measures:
 * 1. Key is not embedded in client bundle (better than NEXT_PUBLIC)
 * 2. Rate limiting per IP (prevents abuse)
 * 3. Request logging (monitor access)
 * 4. IP-based restrictions (optional)
 *
 * IDEAL SOLUTION: Proxy the entire ElevenLabs connection through the backend,
 * but this requires handling audio streaming which is complex.
 */

import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiting (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

function getClientIP(request: NextRequest): string {
  // Try to get real IP from headers (useful behind proxies)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback (won't work in serverless environments)
  return "unknown";
}

export async function POST(request: NextRequest) {
  console.log("\n" + "=".repeat(60));
  console.log("📥 ELEVENLABS SESSION REQUEST RECEIVED");
  console.log("=".repeat(60));

  try {
    const clientIP = getClientIP(request);
    console.log("📍 Client IP:", clientIP);

    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      console.warn(`⚠️ Rate limit exceeded for IP: ${clientIP}`);
      return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 });
    }

    // Get agent ID from environment variable (more reliable than from request)
    const agentIdFromEnv = process.env.ELEVENLABS_AGENT_ID?.trim();
    console.log("🔍 Checking for agent ID in environment...");
    console.log("   ELEVENLABS_AGENT_ID exists:", !!process.env.ELEVENLABS_AGENT_ID);
    console.log("   ELEVENLABS_AGENT_ID length:", process.env.ELEVENLABS_AGENT_ID?.length || 0);
    console.log("   agentIdFromEnv (trimmed) exists:", !!agentIdFromEnv);
    console.log("   agentIdFromEnv (trimmed) length:", agentIdFromEnv?.length || 0);

    // Try to get agent ID from request body, fallback to env var
    const requestBody = await request.json().catch(() => ({}));
    const agentIdFromRequest = requestBody.agentId?.trim();
    const agentId = agentIdFromRequest || agentIdFromEnv;

    if (!agentId) {
      console.error("❌ No agentId found in request or environment");
      return NextResponse.json(
        { error: "Agent ID is required. Set ELEVENLABS_AGENT_ID in .env.local" },
        { status: 400 }
      );
    }

    console.log("🔑 Agent ID to use:", agentId);
    console.log("🔑 Agent ID length:", agentId.length);
    console.log("🔑 Agent ID source:", agentIdFromRequest ? "request" : "environment");

    // Get API key from server-side environment variable (not NEXT_PUBLIC)
    console.log("\n🔍 Checking environment variables...");
    console.log(
      "   All ELEVEN* env vars:",
      Object.keys(process.env).filter((k) => k.includes("ELEVEN"))
    );

    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();

    console.log("   ELEVENLABS_API_KEY exists:", !!process.env.ELEVENLABS_API_KEY);
    console.log("   ELEVENLABS_API_KEY length:", process.env.ELEVENLABS_API_KEY?.length || 0);
    console.log("   apiKey (trimmed) exists:", !!apiKey);
    console.log("   apiKey (trimmed) length:", apiKey?.length || 0);

    if (!apiKey) {
      console.error("\n❌ ELEVENLABS_API_KEY not configured on server");
      console.error(
        "   Available env vars:",
        Object.keys(process.env).filter((k) => k.includes("ELEVEN"))
      );
      return NextResponse.json({ error: "ElevenLabs API key not configured on server" }, { status: 500 });
    }

    console.log("\n✅ API key found!");
    console.log("   Length:", apiKey.length);
    console.log("   Starts with:", apiKey.substring(0, 8) + "...");
    console.log("   Ends with:", "..." + apiKey.substring(apiKey.length - 4));

    // Validate API key format
    if (apiKey.length < 20) {
      console.warn(`⚠️ API key seems too short (${apiKey.length} chars). Expected ~40+ characters.`);
    }

    console.log("\n📤 Returning response to client...");
    const response = {
      agentId,
      apiKey,
    };
    console.log("   Response keys:", Object.keys(response));
    console.log("   Response agentId:", response.agentId);
    console.log("   Response hasApiKey:", !!response.apiKey);
    console.log("   Response apiKey length:", response.apiKey?.length);
    console.log("=".repeat(60) + "\n");

    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ Error in elevenlabs-session route:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
