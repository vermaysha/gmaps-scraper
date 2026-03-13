import puppeteer, { type Browser, type Page } from "puppeteer-core";
import {
  detectChromePath,
  parseDecimalCoordinates,
  parseDmsCoordinates,
  parseUrlCoordinates,
} from "./utils";

export interface ExtractionResult {
  lat: number;
  lng: number;
  accuracy: "high" | "medium" | "low";
  source: "h2_decimal" | "h1_dms" | "url_route";
}

// --- Singleton browser instance ---

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;

  const executablePath = detectChromePath();
  console.log(`Launching Chrome from: ${executablePath}`);

  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-default-apps",
      "--no-first-run",
    ],
  });

  browser.on("disconnected", () => {
    browser = null;
    console.log("Browser disconnected, will re-launch on next request");
  });

  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}

// --- Tier 1: Extract from h2 (decimal coordinates) ---

async function parseFromH2(page: Page): Promise<ExtractionResult | null> {
  try {
    const text = await page.$eval("h2 span", (el) =>
      el.textContent?.trim()
    );
    if (!text) return null;

    const coords = parseDecimalCoordinates(text);
    if (!coords) return null;

    return { ...coords, accuracy: "high", source: "h2_decimal" };
  } catch {
    return null;
  }
}

// --- Tier 2: Extract from h1 (DMS coordinates) ---

async function parseFromH1(page: Page): Promise<ExtractionResult | null> {
  try {
    const text = await page.$eval("h1", (el) =>
      el.textContent?.trim()
    );
    if (!text) return null;

    const coords = parseDmsCoordinates(text);
    if (!coords) return null;

    return { ...coords, accuracy: "medium", source: "h1_dms" };
  } catch {
    return null;
  }
}

// --- Tier 3: Extract from resolved URL ---

async function parseFromUrl(page: Page): Promise<ExtractionResult | null> {
  const url = page.url();
  const coords = parseUrlCoordinates(url);
  if (!coords) return null;

  return { ...coords, accuracy: "low", source: "url_route" };
}

// --- Main extraction function ---

const PAGE_TIMEOUT = 10_000;

export async function extractCoordinates(
  url: string
): Promise<ExtractionResult> {
  const instance = await getBrowser();
  const page = await instance.newPage();

  try {
    // Block resources that aren't needed for coordinate extraction
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (
        type === "image" ||
        type === "media" ||
        type === "font" ||
        type === "stylesheet"
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate — use domcontentloaded instead of networkidle2.
    // networkidle2 waits 500ms after ALL requests settle which is very slow.
    // We'll manually wait for coordinates to appear in DOM instead.
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT,
    });

    // Poll DOM until h2 decimal or h1 DMS coordinates appear, or timeout.
    // This returns as soon as coordinates are visible — no extra waiting.
    // Use a string expression so TypeScript doesn't complain about `document`
    // (this runs in the browser context, not Node/Bun).
    await page
      .waitForFunction(
        `(() => {
          const h2 = document.querySelector("h2 span");
          if (h2?.textContent?.match(/^-?\\d+\\.?\\d*\\s*,\\s*-?\\d+\\.?\\d*$/)) return true;
          const h1 = document.querySelector("h1");
          if (h1?.textContent?.match(/[°]/)) return true;
          return false;
        })()`,
        { timeout: 5_000, polling: 200 }
      )
      .catch(() => {
        // Timed out — coordinates panel may not exist (e.g. route/directions).
        // Fall through to URL-based extraction.
      });

    // Tier 1: h2 decimal coordinates
    const h2Result = await parseFromH2(page);
    if (h2Result) return h2Result;

    // Tier 2: h1 DMS coordinates
    const h1Result = await parseFromH1(page);
    if (h1Result) return h1Result;

    // Tier 3: URL route fallback
    const urlResult = await parseFromUrl(page);
    if (urlResult) return urlResult;

    throw new Error(
      "Could not extract coordinates from the given Google Maps link"
    );
  } finally {
    await page.close().catch(() => {});
  }
}
