FROM oven/bun:1 AS base
WORKDIR /usr/src/app
COPY . .
RUN bun install --production
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "index.ts" ]
