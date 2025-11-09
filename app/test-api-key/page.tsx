"use client";

import { useState } from "react";

export default function TestAPIKey() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const testAPIKey = async () => {
    setLoading(true);
    setResult("Testing...\n");

    try {
      const response = await fetch("/api/test-elevenlabs");
      const data = await response.json();

      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">🧪 Test ElevenLabs API Key</h1>

        <button
          onClick={testAPIKey}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors mb-4"
        >
          {loading ? "Testing..." : "Test API Key"}
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Result:</h2>
          <pre className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 overflow-auto text-sm font-mono text-gray-900 dark:text-white whitespace-pre-wrap">
            {result || "Click the button to test your API key..."}
          </pre>
        </div>
      </div>
    </div>
  );
}

