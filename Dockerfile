FROM node:26-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:26-alpine AS runtime-deps

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM alpine:3.24 AS runtime

RUN apk add --no-cache libstdc++ \
  && addgroup -g 1000 node \
  && adduser -u 1000 -G node -s /bin/sh -D node

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=runtime-deps /usr/local/bin/node /usr/local/bin/node
COPY --chown=node:node --from=runtime-deps /app/server/node_modules ./server/node_modules
COPY --chown=node:node --from=build /app/build ./build
COPY --chown=node:node server ./server

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/healthz || exit 1

CMD ["node", "server/appServer.js"]
