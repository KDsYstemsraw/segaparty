FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json ./
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/sega-party/dist ./artifacts/sega-party/dist

EXPOSE 3000

CMD ["node", "./artifacts/api-server/dist/index.mjs"]
