# This Dockerfile is for local development puproses and gets called in the docker-compose.yml

# Use a Node.js base image which has yarn pre-installed
FROM node:23-bookworm-slim

# Set the working directory so all paths originate per default from here
WORKDIR /vite-app

# Copy package files to the working directory
COPY ./vite-app/package.json ./vite-app/yarn.lock ./
# we only copy the package json over, since the code directories are mapped in the compose file for hot reloading

# install dependencies
RUN yarn install

# Start the app based on the environment (only the last CMD is executed on container start-up)
CMD ["sh", "-c", "echo 'Starting in development mode...' && yarn dev"]
