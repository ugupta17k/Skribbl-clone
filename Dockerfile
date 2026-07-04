FROM oven/bun:1 AS deps

WORKDIR /app

COPY frontend/package.json frontend/bun.lock ./frontend/
COPY backend/package.json backend/bun.lock ./backend/

RUN cd frontend && bun install --frozen-lockfile
RUN cd backend && bun install --frozen-lockfile

FROM deps AS builder

COPY frontend ./frontend
COPY backend ./backend

RUN cd frontend && bun run build
RUN cd backend && bunx prisma generate

FROM oven/bun:1 AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/frontend ./frontend
COPY --from=builder /app/backend ./backend

WORKDIR /app/backend

CMD ["bun", "run", "deploy:start"]
