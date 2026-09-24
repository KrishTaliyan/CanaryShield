# Build: docker build -t flagguard-dashboard dashboard
# Run:   docker run --rm -p 5173:80 flagguard-dashboard
# VITE_* values are baked in at build time; override them with --build-arg.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tailwind.config.js postcss.config.js tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY src ./src
ARG VITE_PLATFORM_URL=http://localhost:8080
ARG VITE_ADMIN_TOKEN=dev-admin-token
ARG VITE_QUICKCART_URL=http://localhost:4000
ARG VITE_USE_MOCKS=false
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Serve index.html for client-side routes such as /flags/new_payment_flow.
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / {\n    try_files $uri /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
