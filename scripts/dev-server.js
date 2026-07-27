import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const PORT = 8000;
const DATA_PATH = path.join(ROOT, "data", "app-data.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isValidData(payload) {
  return Boolean(
    payload &&
      payload.settings &&
      typeof payload.settings.dailyPenaltyRate === "number" &&
      typeof payload.settings.asOfDate === "string" &&
      Array.isArray(payload.periods) &&
      Array.isArray(payload.records),
  );
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/api/data") {
    const content = await fs.readFile(DATA_PATH, "utf8");
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(content);
    return;
  }

  if (request.method === "POST" && request.url === "/api/data") {
    try {
      const body = await readBody(request);
      const payload = JSON.parse(body);
      if (!isValidData(payload)) {
        response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "Invalid payload" }));
        return;
      }

      await fs.writeFile(DATA_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(payload));
    } catch (error) {
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  const requestPath = request.url === "/" ? "/index.html" : request.url;
  const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  try {
    const content = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, { "Content-Type": MIME_TYPES[extension] ?? "application/octet-stream" });
    response.end(content);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error.code === "ENOENT" ? "Not found" : "Server error");
  }
});

server.listen(PORT, () => {
  console.log(`Debit app is running at http://localhost:${PORT}`);
});
