/**
 * Simple test endpoint to verify ElevenLabs API key works
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    const agentId = process.env.ELEVENLABS_AGENT_ID?.trim();

    console.log("\n" + "=".repeat(60));
    console.log("🧪 TESTING ELEVENLABS API KEY");
    console.log("=".repeat(60));
    console.log("API Key exists:", !!apiKey);
    console.log("API Key length:", apiKey?.length || 0);
    console.log("Agent ID exists:", !!agentId);
    console.log("Agent ID length:", agentId?.length || 0);

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 500 });
    }

    // Test 1: Check if API key works
    console.log("\n📡 Test 1: Testing API key with /v1/user endpoint...");
    const userResponse = await fetch("https://api.elevenlabs.io/v1/user", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    });

    console.log("   Status:", userResponse.status, userResponse.statusText);
    
    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log("   ✅ API key works! User:", userData.subscription?.tier || "unknown");
    } else {
      const errorText = await userResponse.text();
      console.log("   ❌ API key test failed");
      console.log("   Error:", errorText.substring(0, 200));
      return NextResponse.json({
        error: "API key test failed",
        status: userResponse.status,
        message: errorText.substring(0, 200),
      }, { status: 500 });
    }

    // Test 2: Try to get signed URL
    if (agentId) {
      console.log("\n📡 Test 2: Testing signed URL endpoint...");
      const signedUrlResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
        {
          method: "GET",
          headers: {
            "xi-api-key": apiKey,
          },
        }
      );

      console.log("   Status:", signedUrlResponse.status, signedUrlResponse.statusText);
      
      if (signedUrlResponse.ok) {
        const signedUrlData = await signedUrlResponse.json();
        console.log("   ✅ Signed URL works!");
        console.log("   Has signed_url:", !!signedUrlData.signed_url);
        return NextResponse.json({
          success: true,
          apiKeyWorks: true,
          signedUrlWorks: true,
          message: "Everything works! API key is valid and can get signed URLs.",
        });
      } else {
        const errorText = await signedUrlResponse.text();
        console.log("   ⚠️ Signed URL failed (this is OK if agent is public)");
        console.log("   Error:", errorText.substring(0, 200));
        return NextResponse.json({
          success: true,
          apiKeyWorks: true,
          signedUrlWorks: false,
          message: "API key works but signed URL failed. Agent might be public or endpoint might be wrong.",
          signedUrlError: errorText.substring(0, 200),
        });
      }
    }

    return NextResponse.json({
      success: true,
      apiKeyWorks: true,
      message: "API key is valid!",
    });
  } catch (error) {
    console.error("❌ Test error:", error);
    return NextResponse.json({
      error: "Test failed",
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

