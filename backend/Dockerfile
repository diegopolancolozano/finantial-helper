FROM oven/bun:1.2 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g typescript prisma
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN prisma generate
RUN tsc -p tsconfig.build.json
RUN test -f dist/main.js || (echo "BUILD FAILED: dist/main.js not found" && exit 1)
RUN npm rebuild bcrypt --update-binary

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 8080
CMD ["sh", "-c", "prisma migrate deploy && node dist/main"]
