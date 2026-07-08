# Use official Node.js light alpine base image
FROM node:20-alpine

# Set Node environment to production
ENV NODE_ENV=production

# Set working directory inside the container
WORKDIR /app

# Copy package dependencies
COPY package*.json ./

# Install only production dependencies cleanly
RUN npm ci --omit=dev

# Copy application source files
COPY . .

# Expose backend service port (express default: 5000)
EXPOSE 5000

# Define start command
CMD ["node", "index.js"]
