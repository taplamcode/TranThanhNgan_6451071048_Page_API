FROM node:20-alpine

WORKDIR /app

# Copy dependencies first
COPY services/backend-api/package*.json ./services/backend-api/
RUN npm install --prefix services/backend-api --omit=dev

# Copy shared modules and service code
COPY shared ./shared
COPY services/backend-api ./services/backend-api

EXPOSE 3000

CMD ["node", "services/backend-api/src/index.js"]
