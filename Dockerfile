FROM node:20-slim

WORKDIR /usr/src/app

COPY package.json ./
RUN npm install --production

COPY . .

RUN mkdir -p data && chown -R node:node /usr/src/app

USER node

EXPOSE 3000
CMD ["node", "server.js"]
