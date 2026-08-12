FROM node:26-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:26-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

COPY --chown=node:node --from=build /app/build ./build
COPY --chown=node:node server ./server

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/healthz || exit 1

CMD ["node", "server/appServer.js"]
