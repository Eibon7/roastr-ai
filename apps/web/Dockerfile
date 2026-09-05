FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN npm install --workspace=@roastr/web --workspace=@roastr/shared

COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

RUN npm run build --workspace=@roastr/shared

ARG VITE_API_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}

RUN npm run build --workspace=@roastr/web

FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
