# Build: docker build -t flagguard-quickcart-server quickcart/server
# Run:   docker run --rm -p 4000:4000 -e PLATFORM_URL=http://host.docker.internal:8080 flagguard-quickcart-server

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
USER node
EXPOSE 4000
CMD ["node", "src/index.js"]
