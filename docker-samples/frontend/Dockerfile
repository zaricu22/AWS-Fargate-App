# syntax=docker/dockerfile:1
#
# Reference/learning Dockerfile for the frontend — the real app is deployed as
# a static S3 + CloudFront site (see infra/lib/frontend-stack.ts), not as a
# container. This shows how you'd containerize it instead.
#
# Build context is the repo root (see docker-samples/docker-compose.yml),
# so COPY paths below are prefixed with frontend/.

ARG NODE_VERSION=20

# ---- build: compile Angular to static files ----
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY frontend/. .
RUN npm run build

# ---- runtime: static files served by nginx, no Node in the final image ----
FROM nginx:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="items-frontend"

# Replaces nginx's default server block (SPA routing: unknown paths -> index.html)
COPY docker-samples/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

# nginx:alpine already ships an unprivileged 'nginx' user
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost:8080/ || exit 1

# nginx image's own ENTRYPOINT already handles startup; CMD just supplies default args
CMD ["nginx", "-g", "daemon off;"]
