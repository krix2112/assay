/**
 * Automated screenshot capture using Chrome Remote Debugging Protocol (CDP).
 * Captures all dashboard pages in both light and dark themes at 1440px and 390px.
 *
 * Runs via: npx tsx scripts/capture-screenshots.ts
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;

const PAGES = [
  { name: "contracts", path: "/contracts" },
  { name: "spreads", path: "/spreads" },
  { name: "data_trust", path: "/data-trust" },
  { name: "backtest", path: "/backtest" },
  { name: "track_record", path: "/track-record" },
  { name: "method", path: "/method" },
  { name: "dashboard", path: "/dashboard" },
];

const VIEWPORTS = [
  { name: "1440px", width: 1440, height: 900, isMobile: false },
  { name: "390px", width: 390, height: 844, isMobile: true },
];

const THEMES = ["light", "dark"] as const;

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

async function main() {
  const screenshotsDir = path.resolve(__dirname, "../screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log("Starting headless Chrome on port 9222...");
  const chromeProc = spawn(
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

  // Wait for Chrome to listen on port 9222
  let connected = false;
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        connected = true;
        break;
      }
    } catch {
      // waiting
    }
  }

  if (!connected) {
    chromeProc.kill();
    throw new Error("Failed to connect to headless Chrome CDP port.");
  }

  console.log("Connected to Chrome. Creating target page...");
  const newTabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:3000`, {
    method: "PUT",
  });
  const tabData = await newTabRes.json();
  const wsUrl = tabData.webSocketDebuggerUrl;

  const client = new CDPClient(wsUrl);
  await client.init();

  await client.send("Page.enable");
  await client.send("DOM.enable");
  await client.send("CSS.enable");

  console.log("Beginning screenshot capture across 1440px and 390px in both themes...");

  for (const page of PAGES) {
    for (const vp of VIEWPORTS) {
      for (const theme of THEMES) {
        const outFileName = `${page.name}_${vp.name}_${theme}.png`;
        const outFilePath = path.join(screenshotsDir, outFileName);

        // 1. Set viewport metrics
        await client.send("Emulation.setDeviceMetricsOverride", {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: vp.isMobile,
        });

        // 2. Navigate to target URL
        const targetUrl = `http://localhost:3000${page.path}`;
        await client.send("Page.navigate", { url: targetUrl });
        await sleep(700);

        // 3. Inject data-theme on <html> element
        await client.send("Runtime.evaluate", {
          expression: `
            document.documentElement.setAttribute('data-theme', '${theme}');
            document.body.setAttribute('data-theme', '${theme}');
            localStorage.setItem('theme', '${theme}');
          `,
        });
        await sleep(300);

        // 4. Capture PNG screenshot
        const screenshotRes = await client.send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: false,
        });

        fs.writeFileSync(outFilePath, Buffer.from(screenshotRes.data, "base64"));
        const stat = fs.statSync(outFilePath);
        console.log(`✓ Saved ${outFileName} (${stat.size} bytes)`);
      }
    }
  }

  client.close();
  chromeProc.kill();

  console.log("\n====================================================");
  console.log("✓ ALL SCREENSHOTS CAPTURED SUCCESSFULLY IN BOTH THEMES");
  console.log("====================================================");
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
