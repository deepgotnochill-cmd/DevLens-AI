FROM node:24-alpine AS build
WORKDIR /site
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
ENV NEXT_PUBLIC_API_URL=/api
RUN npm run build
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site/out /usr/share/nginx/html

