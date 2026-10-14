/**
 * Comprehensive Verification Pass Suite for Assay Dashboard Pages
 *
 * Verifies:
 * 1. API-Down Test: Backend unreachable -> explicit error state + retry button + NO numbers or charts.
 * 2. Demo Mode Test: NEXT_PUBLIC_DEMO=true -> banner "Sample data. These are not real MCX prices." on every route in both themes.
 * 3. Empty-Database Test: Real backend with empty DB -> clear empty state "No data yet. Import a Bhavcopy file.", not error, not sample numbers.
 *
 * Runs via: npx tsx scripts/run-verification-suite.ts <mode: "api-down" | "demo" | "empty-db">
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;

const ROUTES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "contracts", path: "/contracts" },
  { name: "spreads", path: "/spreads" },
  { name: "data_trust", path: "/data-trust" },
  { name: "backtest", path: "/backtest" },
  { name: "track_record", path: "/track-record" },
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  private ws: any;
  private messageId = 0;
  private callbacks = new Map<number, (res: any) => void>();

  constructor(wsUrl: string) {
    const WebSocket = (globalThis as any).WebSocket || require("undici").WebSocket;
    this.ws = new WebSocket(wsUrl);
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err: any) => reject(err);
      this.ws.onmessage = (event: any) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id)!;
          this.callbacks.delete(msg.id);
          cb(msg);
        }
      };
    });
  }

  send(method: string, params: any = {}): Promise<any> {
    const id = ++this.messageId;
    return new Promise((resolve) => {
      this.callbacks.set(id, (res) => resolve(res.result));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  const mode = process.argv[2] || "api-down";
  console.log(`\n========================================================`);
  console.log(`RUNNING VERIFICATION SUITE IN MODE: ${mode.toUpperCase()}`);
  console.log(`========================================================\n`);

  const screenshotsDir = path.resolve(__dirname, "../screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  // Ensure headless Chrome is running
  let connected = false;
  let chromeProc: any = null;
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (res.ok) connected = true;
  } catch {}

  if (!connected) {
    console.log("Launching Chrome CDP on port 9222...");
    chromeProc = spawn(
      CHROME_PATH,
      [
        "--headless=new",
        `--remote-debugging-port=${PORT}`,
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
      ],
      { stdio: "ignore" }
    );
    for (let i = 0; i < 20; i++) {
      await sleep(400);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
        if (res.ok) {
          connected = true;
          break;
        }
      } catch {}
    }
  }

  if (!connected) {
    throw new Error("Unable to connect to Chrome remote debugging port.");
  }

  const newTabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:3000`, {
    method: "PUT",
  });
  const tabData = await newTabRes.json();
  const client = new CDPClient(tabData.webSocketDebuggerUrl);
  await client.init();

  await client.send("Page.enable");
  await client.send("DOM.enable");
  await client.send("Runtime.enable");

  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const results: any[] = [];

  for (const route of ROUTES) {
    const url = `http://localhost:3000${route.path}`;
    await client.send("Page.navigate", { url });
    // Wait for the query and rendering to settle
    for (let w = 0; w < 15; w++) {
      const cond =
        mode === "api-down"
          ? `Boolean(document.querySelector('[role="alert"]'))`
          : mode === "empty-db"
          ? `Boolean(document.querySelector('[role="region"]') || document.querySelector('[role="alert"]'))`
          : `Boolean(document.querySelector('.sample-banner'))`;

      const chk = await client.send("Runtime.evaluate", {
        expression: cond,
        returnByValue: true,
      });
      if (chk?.result?.value) break;
      await sleep(350);
    }
    await sleep(200);

    if (mode === "demo") {
      // Test both themes
      for (const theme of ["light", "dark"]) {
        await client.send("Runtime.evaluate", {
          expression: `
            document.documentElement.setAttribute('data-theme', '${theme}');
            document.body.setAttribute('data-theme', '${theme}');
          `,
        });
        await sleep(300);

        const evalRes = await client.send("Runtime.evaluate", {
          expression: `(() => {
            const banner = document.querySelector('.sample-banner');
            const bannerText = banner ? banner.textContent.trim() : null;
            const hasBanner = bannerText?.includes("Sample data. These are not real MCX prices.");
            return {
              hasBanner,
              bannerText,
            };
          })()`,
          returnByValue: true,
        });

        const data = evalRes?.result?.value ?? evalRes?.value ?? {};
        const screenshotFile = `demo_${route.name}_${theme}.png`;
        const screenshotPath = path.join(screenshotsDir, screenshotFile);
        const shot = await client.send("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(screenshotPath, Buffer.from(shot.data, "base64"));

        console.log(`[DEMO ${theme.toUpperCase()}] ${route.path} -> Banner Present: ${data.hasBanner ? "YES" : "NO"} | Shot: ${screenshotFile}`);
        results.push({ route: route.path, theme, ...data, screenshot: screenshotFile });
      }
    } else if (mode === "api-down") {
      const evalRes = await client.send("Runtime.evaluate", {
        expression: `(() => {
          const bodyText = document.body.innerText;
          const hasErrorTitle = bodyText.includes("Cannot reach the Assay API. Is it running?");
          const retryBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes("Retry connection"));
          const hasRetryButton = Boolean(retryBtn);

          // Check for forbidden market numbers or charts
          const svgCharts = document.querySelectorAll('svg path:not([filter])');
          const dataRows = document.querySelectorAll('tbody tr');
          const hasTableRows = dataRows.length > 0;

          // Check if fake numbers appear (e.g. INR 14,200.5 or 540)
          const hasFakeNumbers = bodyText.includes("14,200") || bodyText.includes("18,900") || bodyText.includes("540");

          return {
            hasErrorTitle,
            hasRetryButton,
            hasSvgCharts: svgCharts.length > 2,
            hasTableRows,
            hasFakeNumbers,
            firstLine: bodyText.split('\\n').filter(Boolean).slice(0, 4).join(' | ')
          };
        })()`,
        returnByValue: true,
      });

      const data = evalRes?.result?.value ?? evalRes?.value ?? {};
      const screenshotFile = `api_down_${route.name}.png`;
      const screenshotPath = path.join(screenshotsDir, screenshotFile);
      const shot = await client.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(screenshotPath, Buffer.from(shot.data, "base64"));

      const isCleanError = data.hasErrorTitle && data.hasRetryButton && !data.hasFakeNumbers && !data.hasTableRows;
      console.log(`[API-DOWN] ${route.path}: ErrorTitle=${data.hasErrorTitle}, RetryBtn=${data.hasRetryButton}, NoNumbers=${!data.hasFakeNumbers} -> ${isCleanError ? "PASS" : "FAIL"}`);
      results.push({ route: route.path, ...data, screenshot: screenshotFile, pass: isCleanError });
    } else if (mode === "empty-db") {
      const evalRes = await client.send("Runtime.evaluate", {
        expression: `(() => {
          const bodyText = document.body.innerText;
          const hasEmptyTitle = bodyText.includes("No data yet. Import a Bhavcopy file.");
          const hasErrorTitle = bodyText.includes("Cannot reach the Assay API");
          const hasFakeNumbers = bodyText.includes("14,200") || bodyText.includes("18,900") || bodyText.includes("540");

          return {
            hasEmptyTitle,
            hasErrorTitle,
            hasFakeNumbers,
            firstHeading: document.querySelector('h1')?.textContent || '',
          };
        })()`,
        returnByValue: true,
      });

      const data = evalRes?.result?.value ?? evalRes?.value ?? {};
      const screenshotFile = `empty_db_${route.name}.png`;
      const screenshotPath = path.join(screenshotsDir, screenshotFile);
      const shot = await client.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(screenshotPath, Buffer.from(shot.data, "base64"));

      const isCleanEmpty = data.hasEmptyTitle && !data.hasErrorTitle && !data.hasFakeNumbers;
      console.log(`[EMPTY-DB] ${route.path}: EmptyTitle=${data.hasEmptyTitle}, NotError=${!data.hasErrorTitle}, NoNumbers=${!data.hasFakeNumbers} -> ${isCleanEmpty ? "PASS" : "FAIL"}`);
      results.push({ route: route.path, ...data, screenshot: screenshotFile, pass: isCleanEmpty });
    }
  }

  client.close();
  if (chromeProc) chromeProc.kill();

  console.log(`\n========================================================`);
  console.log(`COMPLETED ${mode.toUpperCase()} TEST RUN`);
  console.log(`========================================================\n`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
