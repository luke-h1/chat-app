# stage 1 - build base

FROM node:18-alpine as base

WORKDIR /app

COPY src ./src
COPY package.json .
COPY pnpm-lock.yaml .
COPY tsconfig.json .

RUN npm install -g pnpm
RUN pnpm i

# stage 2 - build app
FROM base AS build 
WORKDIR /app
RUN npm install -g pnpm
RUN pnpm i
RUN pnpm build

# stage 3 - prod image
FROM node:18-alpine 
WORKDIR /app
COPY package.json .
COPY pnpm-lock.yaml .
RUN npm install -g pnpm
RUN pnpm i
RUN pnpm i --prod
COPY --from=build /app/build ./

CMD ["node", "main.js"]
