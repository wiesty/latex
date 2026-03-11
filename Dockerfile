# --- Build stage ---
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Production stage ---
FROM node:24-alpine AS runner

WORKDIR /app

# Install TeX Live (basic scheme + commonly used packages)
RUN apk add --no-cache \
    texlive \
    texlive-full \
    perl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV LATEX_CONFIG_DIR=/data/config
ENV LATEX_PROJECTS_DIR=/projects
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create default directories
RUN mkdir -p /data/config /projects && chown nextjs:nodejs /data/config /projects

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
