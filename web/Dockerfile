FROM node:22-alpine AS builder

WORKDIR /build

# Copy package files
COPY web/package.json web/package-lock.json ./

# Install dependencies
RUN npm ci

# Copy application files
COPY web/src ./src
COPY web/public ./public
COPY web/design ./design
COPY web/tsconfig.json .
COPY web/eslint.config.mjs .
COPY web/next.config.ts .
COPY web/vitest.setup.ts web/vitest.config.ts ./
COPY web/test ./test

# Build application
RUN npm run build

# Final stage
FROM node:22-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=nextjs:nodejs /build/.next/standalone/ ./
COPY --from=builder --chown=nextjs:nodejs /build/.next/static/ ./.next/static/
COPY --from=builder --chown=nextjs:nodejs /build/design/ ./design/
COPY --from=builder --chown=nextjs:nodejs /build/public/ ./public/

USER nextjs

EXPOSE 3000

ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
