FROM node:20-alpine
# FFmpeg pour le rendu des montages.
RUN apk add --no-cache ffmpeg font-dejavu && corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm db:generate
CMD ["sh", "-c", "pnpm db:deploy && pnpm --filter @regie/worker start"]
