# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10.34.5

# Install dependencies
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source and prisma definitions
COPY tsconfig*.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma Client & Build TypeScript
RUN pnpm exec prisma generate
RUN pnpm run build

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm@10.34.5

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --ignore-scripts || pnpm install --prod

COPY --from=builder /app/node_modules/.pnpm /app/node_modules/.pnpm
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Run as non-root node user
USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
