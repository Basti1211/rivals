#!/bin/sh

# Substitute the placeholder in the Nginx configuration
envsubst '${BACKEND_HOST_NAME} ${BACKEND_PORT}' < /etc/nginx/conf.d/nginx.template.conf > /etc/nginx/conf.d/default.conf

# Remove the template file after substitution
rm -f /etc/nginx/conf.d/nginx.template.conf

# Start Nginx
nginx -g 'daemon off;'
