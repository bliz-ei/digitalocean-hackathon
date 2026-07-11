FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/extension/package.json apps/extension/package.json
COPY apps/pwa/package.json apps/pwa/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci --omit=dev --ignore-scripts --workspaces=false

FROM node:22-alpine
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY phase0/probes/push ./phase0/probes/push
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER node
CMD ["node", "phase0/probes/push/server.mjs"]
