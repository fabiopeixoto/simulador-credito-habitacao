FROM node:20-slim

WORKDIR /usr/src/app

# better-sqlite3: fallback de compilação nativa (prebuild pode falhar em algumas plataformas)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
