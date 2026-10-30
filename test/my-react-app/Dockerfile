# React + Vite Frontend Dockerfile (Development Server)
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package manifests first for efficient Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server binding to 0.0.0.0 so it is accessible from host machine
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
