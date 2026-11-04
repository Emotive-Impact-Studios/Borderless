#!/bin/sh
set -eu
borderless_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exec sh "$borderless_root/deploy/launch.sh"
