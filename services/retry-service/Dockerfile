FROM node:20-alpine

WORKDIR /app

# Copy dependencies first
COPY services/retry-service/package*.json ./services/retry-service/
RUN npm install --prefix services/retry-service --omit=dev

# Copy shared modules and service code
COPY shared ./shared
COPY services/retry-service ./services/retry-service

EXPOSE 3003

CMD ["node", "services/retry-service/src/index.js"]
