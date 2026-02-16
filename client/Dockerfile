FROM node:20-alpine AS base

WORKDIR /app

# Copy root package files for workspace setup
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY prisma/package.json ./prisma/
COPY prisma/schema.prisma ./prisma/

# Install all dependencies
RUN npm ci

# Copy source code
COPY shared/ ./shared/
COPY client/ ./client/

# Build client — NEXT_PUBLIC_* vars must be set at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

WORKDIR /app/client
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy standalone output
COPY --from=base /app/client/.next/standalone/ ./
COPY --from=base /app/client/.next/static ./client/.next/static
COPY --from=base /app/client/public ./client/public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "client/server.js"]
