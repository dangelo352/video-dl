# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine AS runner
WORKDIR /app

# Install yt-dlp + deno (JS runtime for YouTube extraction)
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    curl \
    deno \
    && pip3 install --break-system-packages yt-dlp \
    && rm -rf /root/.cache/pip

ENV NODE_ENV=production
ENV YT_DLP_PATH=/usr/bin/yt-dlp
ENV FFMPEG_PATH=/usr/bin/ffmpeg

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
