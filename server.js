const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const root = path.resolve(__dirname);
const handler = require(path.join(root, "api", "spreads.js"));

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

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = requestUrl.pathname;

    if (pathname === "/api/spreads") {
      if (req.method !== "POST") {
        res.writeHead(405, { Allow: "POST", "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "Método não suportado" }));
      }
      decorateResponse(res);
      return handler(req, res);
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

    res.writeHead(200, headers);
    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
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
