FROM node:20-alpine AS build

WORKDIR /app

# Copy package files and install dependencies for better layer caching
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Build with backend URL injected at build time
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Copy built application to nginx document root
COPY --from=build /app/dist /usr/share/nginx/html

# Configure nginx for SPA routing
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
