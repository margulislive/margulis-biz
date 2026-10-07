FROM node:22-alpine
WORKDIR /app
COPY . .
ENV DATA_DIR=/data
EXPOSE 8080
CMD ["node", "server.js"]
