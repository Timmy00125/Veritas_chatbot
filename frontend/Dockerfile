FROM node:21-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm && pnpm install

# Copy all files
COPY . .

# Expose port
EXPOSE 3000

# Start development server
CMD ["pnpm", "dev"]