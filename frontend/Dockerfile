# Production Dockerfile
##########################################################
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production Node.js server
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Copy only the built output
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

EXPOSE 4000
CMD ["node", "dist/<your-app-name>/server/server.mjs"]



# # Build stage
# FROM node:22-alpine AS build

# WORKDIR /app

# COPY package*.json ./

# RUN npm install

# COPY . .

# RUN npm run build

# # Runtime stage
# FROM node:22-alpine

# WORKDIR /app

# COPY --from=build /app/dist ./dist
# COPY --from=build /app/package*.json ./

# RUN npm install --omit=dev

# EXPOSE 4000

# CMD ["node", "dist/your-app-name/server/server.mjs"]



# FROM node:22-alpine

# WORKDIR /app

# COPY package*.json ./

# RUN npm install

# COPY . .

# RUN npm run build

# EXPOSE 4000

# CMD ["node", "dist/your-app-name/server/server.mjs"]