# ─── Stage 1: build ────────────────────────────────────────────────────────
FROM node:20-slim AS build

WORKDIR /app

# Separate from the full COPY below so `npm ci` only re-runs when package*.json
# actually changes, not on every source edit.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# react-scripts build (Create React App) inlines process.env.REACT_APP_* into the
# compiled JS bundle at build time via webpack -- unlike a Node server, nothing
# reads these at container *runtime*, so they must be build args here, consumed
# through ARG->ENV before `npm run build` runs, not docker-compose `environment:`
# (which would have zero effect on an already-built static bundle). Confirmed the
# real variable names by grepping src/ directly: REACT_APP_API_URL (fieldops) and
# REACT_APP_AI_URL (the AI module) -- not the "API_BASE_URL" name genuinely absent
# from this codebase.
ARG REACT_APP_API_URL
ARG REACT_APP_AI_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_AI_URL=$REACT_APP_AI_URL

RUN npm run build

# ─── Stage 2: runtime ──────────────────────────────────────────────────────
FROM nginx:alpine AS runtime

COPY --from=build /app/build /usr/share/nginx/html
# nginx.conf here is a server block (not a full top-level nginx.conf with its own
# http{}/events{} wrapper) -- dropped into conf.d/ so it's picked up by the base
# nginx:alpine image's own nginx.conf, which already `include`s conf.d/*.conf inside
# its http{} block. Replaces the stock default.conf outright.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# 127.0.0.1, not localhost -- confirmed directly (docker exec + wget) that this
# nginx:alpine base only binds 0.0.0.0:80 (IPv4), but "localhost" inside the
# container resolves to ::1 (IPv6) first, so wget tried IPv6 and got a real
# connection refused even with nginx correctly up and serving.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
