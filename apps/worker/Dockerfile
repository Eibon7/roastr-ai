FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

RUN npm install --workspace=@roastr/worker --workspace=@roastr/shared

COPY packages/shared/ ./packages/shared/
COPY apps/worker/ ./apps/worker/

RUN npm run build --workspace=@roastr/shared
RUN npm run build --workspace=@roastr/worker

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/

CMD ["node", "apps/worker/dist/main.js"]
