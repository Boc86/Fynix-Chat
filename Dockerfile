FROM node:20-alpine
WORKDIR /app
COPY dist ./dist
EXPOSE 3000
CMD ["npx", "serve", "-l", "3000", "dist"]