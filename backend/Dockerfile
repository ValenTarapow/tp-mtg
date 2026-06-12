FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm rebuild better-sqlite3

COPY src ./src

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]
