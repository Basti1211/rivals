This directory contains the Helm charts for the Kubernetes Deployment.
There is a directory each for the respective service or container which would be part of the docker compose, but now as pods.

IMPORTANT:
The names of the yaml's inside each directory must match the $HELM_VALUES_YAML in the template or local override