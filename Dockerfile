FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm install
COPY dist ./dist
COPY server.js .
COPY server/ ./server/
VOLUME /data
EXPOSE 3000
ENV DATA_DIR=/data
CMD ["node", "server.js"]
