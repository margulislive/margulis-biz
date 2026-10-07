FROM caddy:2-alpine
RUN apk add --no-cache nodejs
WORKDIR /app
COPY Caddyfile /etc/caddy/Caddyfile
COPY . .
ENV DATA_DIR=/data
EXPOSE 8080
CMD ["sh", "-c", "node /app/server.js & exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile"]
