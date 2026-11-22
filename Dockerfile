FROM node:24-bookworm-slim AS api-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --ignore-scripts --no-audit --fund=false
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build && npm prune --omit=dev --ignore-scripts --no-audit --fund=false

FROM node:24-bookworm-slim AS api
WORKDIR /app/backend
ENV NODE_ENV=development
COPY --from=api-build /app/backend/package.json ./
COPY --from=api-build /app/backend/node_modules ./node_modules
COPY --from=api-build /app/backend/dist ./dist
COPY backend/migrations ./migrations
USER node
CMD ["node", "dist/server.js"]

FROM node:24-bookworm-slim AS web-build
WORKDIR /app/balaqoldau
COPY balaqoldau/package*.json ./
RUN npm ci --ignore-scripts --no-audit --fund=false
COPY balaqoldau/index.html balaqoldau/vite.config.ts balaqoldau/tsconfig*.json ./
COPY balaqoldau/src ./src
COPY balaqoldau/public ./public
COPY scripts/release-policy.mjs ../scripts/
COPY release-assets.json ../
RUN npm run build

FROM nginx:stable-alpine AS web
COPY deploy/judge-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/balaqoldau/dist /usr/share/nginx/html
