import { Elysia, t } from "elysia";
import { extractCoordinates, closeBrowser } from "./src/extractor";
import { validateGmapsUrl } from "./src/utils";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

const app = new Elysia()
  .get("/health", () => ({ status: "ok" }))
  .get(
    "/api/location",
    async ({ query, set }) => {
      const rawUrl = query.url;

      // Validate the URL
      try {
        validateGmapsUrl(rawUrl);
      } catch (err) {
        set.status = 400;
        return {
          success: false,
          error: err instanceof Error ? err.message : "Invalid URL",
        };
      }

      // Extract coordinates
      try {
        const result = await extractCoordinates(rawUrl);
        return {
          success: true,
          data: result,
        };
      } catch (err) {
        set.status = 500;
        return {
          success: false,
          error:
            err instanceof Error ? err.message : "Failed to extract coordinates",
        };
      }
    },
    {
      query: t.Object({
        url: t.String(),
      }),
    }
  )
  .listen(PORT);

console.log(`🚀 Server running at http://localhost:${PORT}`);
console.log(`   GET /api/location?url=<google_maps_url>`);
console.log(`   GET /health`);

// Graceful shutdown
async function shutdown() {
  console.log("\nShutting down...");
  await closeBrowser();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);