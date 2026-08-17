FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000

# Dev server is fine for a self-hosted single-user tool; swap for `build` + a
# static server if you want a production-style deployment later.
CMD ["npm", "run", "dev"]
