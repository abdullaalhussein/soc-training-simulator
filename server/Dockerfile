FROM node:20-alpine AS base

WORKDIR /app

# Copy root package files for workspace setup
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY prisma/package.json ./prisma/
COPY client/package.json ./client/

# Copy prisma schema and migrations BEFORE npm ci (postinstall runs prisma generate)
COPY prisma/schema.prisma ./prisma/
COPY prisma/migrations/ ./prisma/migrations/

# Install all dependencies (postinstall will run prisma generate)
RUN npm ci

# Copy source code
COPY shared/ ./shared/
COPY server/ ./server/

# Build server
WORKDIR /app/server
RUN npx tsc

# Production stage
FROM node:20-alpine AS production

RUN apk add --no-cache yara

WORKDIR /app

COPY --from=base /app/package.json /app/package-lock.json ./
COPY --from=base /app/shared/ ./shared/
COPY --from=base /app/server/package.json ./server/
COPY --from=base /app/prisma/ ./prisma/
COPY --from=base /app/client/package.json ./client/

RUN npm ci --omit=dev
RUN npx prisma generate --schema=prisma/schema.prisma

COPY --from=base /app/server/dist/ ./server/dist/

# Copy seed files for db:seed command
COPY prisma/seed.ts ./prisma/
COPY prisma/seed-data/ ./prisma/seed-data/

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

WORKDIR /app/server

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --schema=../prisma/schema.prisma && node dist/index.js"]
