import { existsSync } from "fs";

// --- Chrome/Chromium auto-detection ---

const LINUX_PATHS = [
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/snap/bin/chromium",
];

const MACOS_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

export function detectChromePath(): string {
  // Env vars take priority
  const envPath = process.env.CHROME_PATH ?? process.env.CHROMIUM_PATH;
  if (envPath && existsSync(envPath)) return envPath;

  const candidates =
    process.platform === "darwin"
      ? [...MACOS_PATHS, ...LINUX_PATHS]
      : LINUX_PATHS;

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  throw new Error(
    "Chrome/Chromium not found. Install Chrome or set CHROME_PATH env var."
  );
}

// --- URL validation (SSRF protection) ---

const ALLOWED_HOSTS = [
  "maps.app.goo.gl",
  "goo.gl",
  "www.google.com",
  "google.com",
  "maps.google.com",
];

export function validateGmapsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http/https URLs are allowed");
  }

  const host = url.hostname.toLowerCase();
  const isAllowed = ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));

  if (!isAllowed) {
    // Also allow google.*/maps paths
    const isGoogleMaps =
      host.match(/^(www\.)?google\.[a-z.]+$/) && url.pathname.startsWith("/maps");
    if (!isGoogleMaps) {
      throw new Error(
        "URL must be a Google Maps link (maps.app.goo.gl, google.com/maps, etc.)"
      );
    }
  }

  return url;
}

// --- DMS to Decimal conversion ---

/**
 * Parses a DMS string like `7°33'16.5"S` into a decimal degree value.
 */
export function dmsToDecimal(dms: string): number | null {
  // Match patterns like: 7°33'16.5"S or 110°52'08.1"E
  const match = dms.match(
    /(\d+)[°]\s*(\d+)[''′]\s*([\d.]+)[""″]?\s*([NSEW])/i
  );
  if (!match) return null;

  const degrees = parseFloat(match[1]!);
  const minutes = parseFloat(match[2]!);
  const seconds = parseFloat(match[3]!);
  const direction = match[4]!.toUpperCase();

  let decimal = degrees + minutes / 60 + seconds / 3600;

  if (direction === "S" || direction === "W") {
    decimal = -decimal;
  }

  // Round to 6 decimal places for practical precision
  return Math.round(decimal * 1e6) / 1e6;
}

/**
 * Parses a full DMS coordinate string like `7°33'16.5"S 110°52'08.1"E`
 * into { lat, lng }.
 */
export function parseDmsCoordinates(
  text: string
): { lat: number; lng: number } | null {
  // Match two DMS groups
  const parts = text.match(
    /(\d+[°]\s*\d+[''′]\s*[\d.]+[""″]?\s*[NSEW])\s+(\d+[°]\s*\d+[''′]\s*[\d.]+[""″]?\s*[NSEW])/i
  );
  if (!parts) return null;

  const first = dmsToDecimal(parts[1]!);
  const second = dmsToDecimal(parts[2]!);
  if (first === null || second === null) return null;

  return { lat: first, lng: second };
}

/**
 * Parses a decimal coordinate string like `-7.554585, 110.868927` into { lat, lng }.
 */
export function parseDecimalCoordinates(
  text: string
): { lat: number; lng: number } | null {
  const match = text.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (!match) return null;

  const lat = parseFloat(match[1]!);
  const lng = parseFloat(match[2]!);

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

/**
 * Extracts coordinates from a Google Maps URL containing `@lat,lng` pattern.
 */
export function parseUrlCoordinates(
  url: string
): { lat: number; lng: number } | null {
  const match = url.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+)/);
  if (!match) return null;

  const lat = parseFloat(match[1]!);
  const lng = parseFloat(match[2]!);

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}
