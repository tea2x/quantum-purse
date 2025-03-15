#!/bin/bash

# Check if the Docker image exists, if not, build it
if ! docker image inspect ckb >/dev/null 2>&1; then
  echo "Docker image 'ckb' not found. Building..."
  docker build --no-cache -t ckb . || { echo "Failed to build Docker image."; exit 1; }
fi

# Check if the container exists
if docker ps -a --format '{{.Names}}' | grep -q "^ckb-test-node$"; then
  # Check if the container is already running
  if docker ps --format '{{.Names}}' | grep -q "^ckb-test-node$"; then
    echo "ckb test node is already running."
  else
    echo "ckb test node exists but is stopped. Restarting..."
    docker start ckb-test-node
  fi
else
  docker run -d --name ckb-test-node -p 8114:8114 \
    -v $(pwd)/rust-quantum-resistant-lock-script/build/release/qr-lock-script:/ckb/qr-lock-script \
    -it ckb > /dev/null
  echo "Waiting for ckb test node to start..."
fi

# Wait for ckb node to be ready
until curl -s -X POST http://localhost:8114 -H "Content-Type: application/json" -d '{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "get_blockchain_info",
  "params": []
}' | grep -q '"result"'
do
  sleep 1s
done
