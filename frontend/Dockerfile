# syntax=docker/dockerfile:1

# Multi-stage build for the SPA:
#   build   -> Node compiles the static bundle (Node never ships in the final image)
#   runtime -> unprivileged nginx serves /dist and reverse-proxies /api to the backend

ARG NODE_VERSION=24
ARG NGINX_VERSION=1.30

################################################################################
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

# Manifest first: this layer (and the npm cache mount) is reused until dependencies change.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY . .
RUN npm run build

################################################################################
# nginx-unprivileged runs as uid 101 (non-root) and listens on 8080, so it needs no extra capabilities.
FROM nginxinc/nginx-unprivileged:${NGINX_VERSION}-alpine AS runtime

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
