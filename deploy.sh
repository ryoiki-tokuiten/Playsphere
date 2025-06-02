#!/bin/bash

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Build the application
echo "Building application..."
npm run build

# Create symbolic link from dist/server/public to dist/public
echo "Setting up proper directory structure..."
mkdir -p dist/server/public
rm -rf dist/server/public
ln -s ../public dist/server/public

# Run database migrations
echo "Running database migrations..."
npm run db:migrate

# Start the application in production mode
echo "Starting application in production mode..."
NODE_ENV=production PORT=5000 DATABASE_URL="$DATABASE_URL" node dist/server/index.js
