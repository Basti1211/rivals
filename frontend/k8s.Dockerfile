# This Dockerfile is for the deployment on kubernetes and is referenced in the gitlab-ci.yml

# use this almost identical copy of the dev.Dockerfile to create a build that is then used below in the nginx image
FROM node:23-bookworm-slim AS build

# Set the working directory so we have a known root for later in the serve step
WORKDIR /frontend-app

# Copy package files and install dependencies usign yarn
COPY ./vite-app/package.json ./vite-app/yarn.lock ./
RUN yarn install

# Copy over the application code to the workdir, so we can build in the next step
COPY ./vite-app ./

# Build the app so we can run the "preview"
RUN yarn build



# Serve the application with Nginx
FROM nginx:alpine

# Copy the built files from the previous stage out of its defined WORKDIR
COPY --from=build /frontend-app/dist /usr/share/nginx/html

# Copy the Nginx template configuration file
COPY nginx-deployment/nginx.template.conf /etc/nginx/conf.d/nginx.template.conf

# Copy the entrypoint script
COPY nginx-deployment/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Expose the application port
EXPOSE 80

# Use the entrypoint script
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
