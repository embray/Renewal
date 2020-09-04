# Renewal backend Docker image

This directory contains files for Docker containers for the Renewal backend
services.

Currently all services run from the same Docker image, with one container
for each service (at a minimum--all services except the controller can run
multiple instances).

The Dockerfile and docker-compose.yml file here are currently just for
development and testing, and are not production-ready.

The file `feeds.json` contains a list of default feeds that can loaded into
the controller upon starting a Docker container for the controller by
running:

```bash
$ docker exec <controller-container> renewalctl feeds load docker/feeds.json
```

This list of RSS feeds came from the original prototype code for the feed
processor, and some of them are not active or not great quality; this will
be updated in the future with a better curated list of feeds.
