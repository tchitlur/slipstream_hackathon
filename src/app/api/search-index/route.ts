import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-static";

export function GET() {
  const p = path.join(process.cwd(), "data", "derived", "search-index.json");
  const body = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : JSON.stringify({ docs: [], synonyms: {} });
  return new Response(body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
