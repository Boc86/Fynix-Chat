FROM node:20-alpine
WORKDIR /app
COPY dist ./dist
EXPOSE 3000
CMD ["npx", "-y", "serve", "-s", "-l", "3000", "dist"]