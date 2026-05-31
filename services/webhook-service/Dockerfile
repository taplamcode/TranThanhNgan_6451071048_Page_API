FROM node:20-alpine

WORKDIR /app

# Copy dependencies first
COPY services/webhook-service/package*.json ./services/webhook-service/
RUN npm install --prefix services/webhook-service --omit=dev

# Copy shared modules and service code
COPY shared ./shared
COPY services/webhook-service ./services/webhook-service

EXPOSE 3001

CMD ["node", "services/webhook-service/src/index.js"]
