FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
# Cambiato da npm ci a npm install per risolvere il disallineamento del lockfile
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
# Usiamo install anche qui per coerenza, rimuovendo le devDependencies
RUN npm install --omit=dev && npm cache clean --force

COPY --chown=node:node --from=build /app/build ./build
COPY --chown=node:node server ./server

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/healthz || exit 1

CMD ["node", "server/appServer.js"]