import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const ROOT_DIR = resolve(process.cwd());

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".wav": "audio/wav",
};

createServer((request, response) => {
  try {
    const requestPath = new URL(request.url || "/", `http://${HOST}:${PORT}`).pathname;
    const safePath = normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
    let filePath = resolve(join(ROOT_DIR, safePath));

    if (!filePath.startsWith(ROOT_DIR)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, "index.html");
    }

    if (!existsSync(filePath)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": CONTENT_TYPES[extname(filePath)] || "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal server error");
  }
}).listen(PORT, HOST, () => {
  console.log(`AudioAnnotator server running at http://${HOST}:${PORT}`);
});
