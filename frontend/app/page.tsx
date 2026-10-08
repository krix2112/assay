"use client";

import { useEffect, useState } from "react";

type HealthStatus = "connected" | "unreachable" | "checking";

interface HealthData {
  status: string;
  environment: string;
  database: string;
}

export default function Home() {
  const [status, setStatus] = useState<HealthStatus>("checking");
  const [healthData, setHealthData] = useState<HealthData | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    async function checkHealth() {
      try {
        const response = await fetch(`${apiUrl}/health`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: HealthData = await response.json();
        setHealthData(data);
        setStatus("connected");
      } catch (err) {
        setStatus("unreachable");
      }
    }

    checkHealth();
  }, [apiUrl]);

  return (
    <main className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Assay</h1>
      <p className="text-gray-600 mb-6">
        Daily intelligence tool that compares MCX gold futures contracts.
      </p>

      <div className="border border-gray-300 rounded p-4 bg-white">
        <p className="font-medium">
          Backend:{" "}
          <span
            className={
              status === "connected"
                ? "text-green-600 font-semibold"
                : status === "unreachable"
                ? "text-red-600 font-semibold"
                : "text-gray-500"
            }
          >
            {status === "checking"
              ? "checking..."
              : status === "connected"
              ? "connected"
              : "unreachable"}
          </span>
        </p>

        {healthData && (
          <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-700">
            <p>Environment: {healthData.environment}</p>
            <p>Database: {healthData.database}</p>
          </div>
        )}
      </div>
    </main>
  );
}
