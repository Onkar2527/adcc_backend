# Multi-stage build for NestJS backend
# Stage 1: Build the application
FROM node:20 AS builder

WORKDIR /usr/src/app

# Copy dependency files
COPY package*.json ./

# Install all dependencies (including devDependencies to build TypeScript)
RUN npm ci

# Copy source code and configuration files
COPY . .

# Build the NestJS application
RUN npm run build

# Stage 2: Runtime environment
FROM node:20-slim AS runner

WORKDIR /usr/src/app

# Set production environment
ENV NODE_ENV=production

# Copy dependency files
COPY package*.json ./

# Install only production dependencies (excluding devDependencies)
RUN npm ci --omit=dev && npm cache clean --force

# Copy the built application from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Create uploads directory if it doesn't exist
RUN mkdir -p uploads

# Expose NestJS port
EXPOSE 3577

# Command to run the application
CMD ["node", "dist/main"]
