const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { URL } = require("url");

const root = path.resolve(__dirname);
const spreadsHandler = require(path.join(root, "api", "spreads.js"));
const commentsHandler = require(path.join(root, "api", "comments.js"));
const banksHandler = require(path.join(root, "api", "banks.js"));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

const cacheControlHeaders = {
  "/sw.js": "no-cache",
  "/manifest.json": "max-age=86400",
  "/icon.svg": "max-age=31536000, immutable",
  "/og-image.svg": "max-age=31536000, immutable",
};

function getCacheControl(pathname, ext) {
  if (cacheControlHeaders[pathname]) return cacheControlHeaders[pathname];
  if ([".js", ".css", ".svg", ".json", ".png", ".jpg", ".jpeg", ".webmanifest"].includes(ext)) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=0, no-cache";
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function getCompression(req, contentType) {
  if (!contentType) return null;
  const isCompressible =
    contentType.startsWith("text/") ||
    contentType.includes("javascript") ||
    contentType.includes("json") ||
    contentType.includes("xml") ||
    contentType.includes("svg");
  if (!isCompressible) return null;

  const accept = String(req.headers["accept-encoding"] || "").toLowerCase();
  if (accept.includes("br")) return "br";
  if (accept.includes("gzip")) return "gzip";
  return null;
}

function decorateResponse(res) {
  let sent = false;

  res.status = function (statusCode) {
    res.statusCode = statusCode;
    return res;
  };

  res.json = function (payload) {
    if (sent) return res;
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(payload));
    sent = true;
    return res;
  };

  res.send = function (payload) {
    if (sent) return res;
    if (!res.headersSent) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    res.end(typeof payload === "string" ? payload : String(payload));
    sent = true;
    return res;
  };

  return res;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

async function runApiHandler(req, res, requestUrl, handler) {
  decorateResponse(res);
  req.query = Object.fromEntries(requestUrl.searchParams.entries());

  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    try {
      req.body = await readJsonBody(req);
    } catch (_) {
      return sendJson(res, 400, { error: "JSON inválido" });
    }
  }

  return handler(req, res);
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = requestUrl.pathname;

    if (pathname === "/api/spreads") {
      if (req.method !== "POST") {
        res.writeHead(405, { Allow: "POST", "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "Método não suportado" }));
      }
      return runApiHandler(req, res, requestUrl, spreadsHandler);
    }

    if (pathname === "/api/comments") {
      if (!["GET", "POST", "DELETE", "OPTIONS"].includes(req.method)) {
        res.writeHead(405, { Allow: "GET, POST, DELETE, OPTIONS", "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "Método não suportado" }));
      }
      return runApiHandler(req, res, requestUrl, commentsHandler);
    }

    if (pathname === "/api/banks") {
      if (!["GET", "POST", "PUT", "DELETE", "OPTIONS"].includes(req.method)) {
        res.writeHead(405, { Allow: "GET, POST, PUT, DELETE, OPTIONS", "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "Método não suportado" }));
      }
      return runApiHandler(req, res, requestUrl, banksHandler);
    }

    let filePath = pathname === "/" ? "/index.html" : pathname;
    filePath = decodeURIComponent(filePath);
    const normalizedPath = path.normalize(filePath).replace(/^([/\\]+|\.\.\/?)+/, "");
    const fullPath = path.join(root, normalizedPath);

    if (!fullPath.startsWith(root)) {
      return sendJson(res, 400, { error: "Caminho inválido" });
    }

    const stat = await fs.promises.stat(fullPath).catch(() => null);
    if (!stat || !stat.isFile()) {
      return sendJson(res, 404, { error: "Não encontrado" });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const headers = {
      "Content-Type": contentType,
      "Cache-Control": getCacheControl(pathname, ext),
      "X-Content-Type-Options": "nosniff",
    };

    const stream = fs.createReadStream(fullPath);
    const compression = getCompression(req, contentType);
    if (compression === "br") {
      headers["Content-Encoding"] = "br";
      headers["Vary"] = "Accept-Encoding";
      res.writeHead(200, headers);
      stream.pipe(zlib.createBrotliCompress()).pipe(res);
    } else if (compression === "gzip") {
      headers["Content-Encoding"] = "gzip";
      headers["Vary"] = "Accept-Encoding";
      res.writeHead(200, headers);
      stream.pipe(zlib.createGzip()).pipe(res);
    } else {
      res.writeHead(200, headers);
      stream.pipe(res);
    }
    stream.on("error", (error) => {
      console.error(error);
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Erro no servidor" }));
    });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Erro no servidor" });
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
