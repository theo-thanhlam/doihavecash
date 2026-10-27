# syntax=docker/dockerfile:1

# Install all dependencies (dev ones too: the build and drizzle-kit need them).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build the app. docker-compose.prod.yml also uses this stage to run migrations.
FROM deps AS builder
COPY . .
# public/ may be empty, and git doesn't keep empty folders.
RUN mkdir -p public && npm run build

# Small runtime image: only the standalone server, no source or dev deps.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
