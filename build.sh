#!/bin/bash
set -e

echo "Installing Git LFS..."
git lfs install

echo "Pulling LFS files..."
git lfs pull

echo "Building project..."
npm run build

echo "Build complete!"
