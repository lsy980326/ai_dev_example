#!/usr/bin/env bash
set -euo pipefail
STUDY_HOOK_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
cd "$STUDY_HOOK_ROOT"
exec bash ./dev agent-stop-check
