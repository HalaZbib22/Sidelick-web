# Backend Dockerfile for Sidelick (Express + TypeScript)
# Multi-stage build for optimized production image

# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and TypeScript config
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy built code from builder
COPY --from=builder /app/dist ./dist

# Copy seed assets if needed for production
COPY --from=builder /app/seed_assets ./seed_assets
COPY --from=builder /app/scripts ./scripts

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

USER expressjs

EXPOSE 4000

ENV PORT 4000

CMD ["node", "dist/index.js"]
