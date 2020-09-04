#!/bin/bash

# Performs some initialization steps for the backend services that make
# launching a complete working backend for development/testing purposes easy
# without having to perform too many manual steps.  In particular:
#
# * Installs a default list of feeds from feeds.json
#
# * Registers a baseline recsystem (just one for now, maybe more later)
#   and stores its token in a volume which is mounted by the
#   recsys_baseline service.
set -e
set -x

# This is mounted as a volume by the docker-compose file.
CONFIG_DIR="/etc/renewal"

APP_DIR="/usr/src/app"

tries=0
while [ $tries -lt 5 ]; do
    if renewalctl status; then
        break
    fi

    echo 'could not contact the controller yet; retrying in 1 second'
    sleep 1
    tries=$(( $tries + 1 ))
done

if [ $tries -eq 5 ]; then
    echo 'could not contact the controller after 5 tries; exiting' >&2
    exit 1
fi


# Install default feeds if no other feeds have already been registered
# Listing the feeds in CSV format with no header is an easy way to get
# a count of registered feeds.
n_feeds=$(renewalctl feeds list --format=csv --no-header | wc -l; exit ${PIPESTATUS[0]})
if [ $? -eq 1 ]; then
    echo 'error fetching feeds; perhaps the controller is not running yet' >&2
    exit 1
fi

if [ $n_feeds -eq 0 ]; then
    renewalctl feeds load "${APP_DIR}/docker/feeds.json"
fi


# Register a baseline recsystem and output its authentication token to a file
# in the config volume.
# TODO: Later this could be extended to support installing more than one
# baseline; in the meantime the baseline is hard-coded.
RECSYS_NAME="baseline-random-1"
RECSYS_TOKEN_FILE="${CONFIG_DIR}/${RECSYS_NAME}.jwt"
if ! renewalctl recsys list | grep -q "$RECSYS_NAME" 2>/dev/null; then
    token="$(renewalctl recsys register --baseline $RECSYS_NAME | cut -d' ' -f2)"
    if [ -n "$token" ]; then
        echo -n "$token" > "$RECSYS_TOKEN_FILE"
    else
        echo "failed to initialize baseline recsys" >&2
        exit 1
    fi
else
    if [ ! -f "$RECSYS_TOKEN_FILE" ]; then
        # The baseline recsys already exists but we don't know its token, so
        # generate a new token for it
        token="$(renewalctl recsys refresh-token "$RECSYS_NAME")"
        if [ $? -eq 0 ]; then
            echo -n "$token" > "$RECSYS_TOKEN_FILE"
        else
            echo "failed to generate a new auth token for the baseline recsys" >&2
            exit 1
        fi
    fi
fi
