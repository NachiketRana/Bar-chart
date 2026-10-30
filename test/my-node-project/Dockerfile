# Node.js Express Backend Dockerfile
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package manifests first for efficient Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Expose backend port
EXPOSE 5000

# Start Express server
CMD ["npm", "start"]
