FROM node:20-alpine

WORKDIR /app

# Copy dependencies first
COPY services/core-service/package*.json ./services/core-service/
RUN npm install --prefix services/core-service --omit=dev

# Copy shared modules and service code
COPY shared ./shared
COPY services/core-service ./services/core-service

EXPOSE 3002

CMD ["node", "services/core-service/src/index.js"]
