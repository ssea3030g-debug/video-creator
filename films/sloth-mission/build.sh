#!/bin/sh
# 「똥 작전」 한 번에 다시 만들기: sh films/sloth-mission/build.sh
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
LIB=${LIB:-$HOME/lemo-opuscar}
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the library folder"; exit 1; }
sh "$HERE/tools/fonts.sh"
cd "$LIB"
"$LIB/.venv/bin/python" core/audio/sampler.py --need "$HERE/mix.py"
# node core/render/readcheck.mjs "$HERE" --size 1080x1920
node core/render/events.mjs "$HERE" --size 1080x1920
"$LIB/.venv/bin/python" "$HERE/mix.py"
node core/render/video.mjs "$HERE" --fps 24 --size 1080x1920 --workers 3 --out "$HERE/out/video.mp4"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/sloth-mission.mp4" 24 2
(cd "$HERE" && node --input-type=module -e "import('./film.js').then(m=>console.log(JSON.stringify(m.srtCues())))") > "$HERE/out/cues.json"
"$LIB/.venv/bin/python" core/render/srt.py "$HERE/out/cues.json" "$HERE/sloth-mission.srt"
node core/render/still.mjs "$HERE" 27.6 --size 1080x1920 --out "$HERE/out/poster"
cp "$HERE/out/poster/t_27.6.jpg" "$HERE/poster.jpg"
