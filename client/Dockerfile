# client/Dockerfile

# --- Build stage ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# API base URL passed in at build time (defaults to local backend)
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# --- Run stage ---
FROM nginx:alpine

ENV NODE_ENV=production

# Copy built assets to nginx html folder
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: basic SPA config so all routes go to index.html
# (Create nginx.conf in client/ if you want custom routing)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
