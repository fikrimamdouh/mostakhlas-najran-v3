#!/bin/bash
set -e

# Always enforce correct git identity after every merge
bash scripts/setup-git.sh

pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push
