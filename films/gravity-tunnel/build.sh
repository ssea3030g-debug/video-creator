#!/bin/sh
# Rebuild "42분 터널" from scratch: sh build.sh   (LIB = the Lemo-Opuscar library; needs ffmpeg 7+ on PATH)
set -e
LIB=${LIB:-$HOME/lemo-opuscar}   # the Lemo-Opuscar library folder
HERE=$(cd "$(dirname "$0")" && pwd)
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the library folder"; exit 1; }
cd "$LIB"
SZ="--size 1080x1920"
node core/render/events.mjs "$HERE" $SZ                                 # timeline → events.json
"$LIB/.venv/bin/python" "$HERE/mix.py"                                  # score + foley → mix.wav
"$LIB/.venv/bin/python" "$HERE/subs.py"                                 # gravity-tunnel.srt
node core/render/readcheck.mjs "$HERE" $SZ --step 0.1                   # every text stays long enough to read
node core/render/video.mjs "$HERE" $SZ --fps 24 --workers 3 --out "$HERE/out/video.mp4"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/mix.wav" "$HERE/gravity-tunnel.mp4" 24 0
node core/render/still.mjs "$HERE" 28.0 $SZ --prefix poster_ --out "$HERE/out" && cp "$HERE/out/poster_28.0.jpg" "$HERE/poster.jpg"
