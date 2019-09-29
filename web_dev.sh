#!/bin/bash

function cleanup {
  echo "shutting down..."
  docker-compose down
}
trap cleanup EXIT

# docker-compose up

docker-compose up -d
docker attach skittles-br_web_1

