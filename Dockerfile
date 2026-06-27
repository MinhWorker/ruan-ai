# Stage 1: build
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies (layer-cached unless lockfile changes)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ src/
RUN npm run build

# Stage 2: production
FROM node:22-alpine AS production

WORKDIR /app

# Install production-only dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled output from build stage
COPY --from=build /app/dist ./dist

# Cloud Run injects PORT; default to 8080 for local testing
ENV PORT=8080

EXPOSE ${PORT}

# Run as non-root for security
USER node

CMD ["node", "dist/main.js"]
