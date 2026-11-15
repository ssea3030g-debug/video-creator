#!/bin/sh
# Rebuild "Dry Gulch" from scratch: sh build.sh   (LIB = the Lemo-Opuscar library; needs ffmpeg 7+ on PATH)
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
LIB=${LIB:-$HOME/lemo-opuscar}   # the Lemo-Opuscar library folder
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the library folder"; exit 1; }
cd "$LIB"
node core/render/events.mjs "$HERE"                                      # timeline → events.json
"$LIB/.venv/bin/python" "$HERE/mix.py"                                   # chip score + foley → mix.wav
node "$HERE/subs.mjs" "$HERE"                                            # dry-gulch.srt
node core/render/readcheck.mjs "$HERE"                                   # every text stays long enough to read
node core/render/video.mjs "$HERE" --fps 24 --workers 3 --out "$HERE/out/video.mp4"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/mix.wav" "$HERE/dry-gulch.mp4" 24 0
node core/render/still.mjs "$HERE" 31.2 --prefix poster_ --out "$HERE/out" && cp "$HERE/out/poster_31.2.jpg" "$HERE/poster.jpg"
