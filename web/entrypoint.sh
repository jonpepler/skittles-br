#!/bin/bash
set -e

# Remove a potentially pre-existing server.pid for Rails.
rm -f /skittles-br/tmp/pids/server.pid

# Create the DB and migrate as required
bundle exec rails db:migrate 2>/dev/null || bundle exec rails db:setup

# Then exec the container's main process (what's set as CMD in the Dockerfile).
exec "$@"
