FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/data ./seed-data
COPY --from=build --chown=nextjs:nodejs /app/migrations ./migrations

RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

CMD echo "=== Populus startup ===" && \
    echo "RESEED_DB=$RESEED_DB" && \
    echo "DB exists: $([ -f ./data/mit-people.db ] && echo yes || echo no)" && \
    echo "Seed DB size: $(ls -la ./seed-data/mit-people.db 2>/dev/null || echo 'MISSING')" && \
    if [ "$RESEED_DB" = "true" ] || [ ! -f ./data/mit-people.db ]; then \
      echo "Copying seed data to /app/data..." && \
      cp -rv ./seed-data/* ./data/ && \
      echo "Copy done. DB size: $(ls -la ./data/mit-people.db)" ; \
    else \
      echo "Skipping seed (DB already exists)" ; \
    fi && \
    echo "Final DB: $(ls -la ./data/mit-people.db 2>/dev/null || echo 'NO DB FILE')" && \
    node server.js
