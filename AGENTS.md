# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Portuguese mortgage simulator web app — a single Node.js server (`server.js`) that serves a pre-compiled React frontend (`index.html`) and two API endpoints (`/api/spreads`, `/api/comments`). SQLite databases (`data/spreads.sqlite`, `data/comments.sqlite`) are auto-created on first request.

### Running the application

```bash
npm start          # or: node server.js
# Server listens on http://localhost:3000
```

### Key notes

- **No build step**: the frontend is a pre-compiled React bundle in `index.html`. There is no separate build or transpile step.
- **No lint/test scripts**: `package.json` only defines `npm start`. There are no lint, test, or build scripts in the repo.
- **Single dependency**: `better-sqlite3` is a native C++ addon — `npm install` compiles it, so `python3`, `make`, and `g++` must be available.
- **SQLite auto-init**: the `data/` directory and `.sqlite` files are created automatically on first API call; no manual migration needed.
- **ANTHROPIC_API_KEY** is optional: without it, `/api/spreads` returns 503 but the app is fully functional with its bundled hardcoded data.
- **Port**: defaults to `3000`; override with `PORT` env var.
