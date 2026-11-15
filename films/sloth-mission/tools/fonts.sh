#!/bin/sh
# OFL 한글 폰트(Black Han Sans, Jua)를 film.js에 쓰인 글자만 서브셋해서 fonts/에 받는다.
set -e
HERE=$(cd "$(dirname "$0")/.." && pwd); D="$HERE/fonts"; mkdir -p "$D"
TXT=$(python3 -c "
import re,sys,urllib.parse
s=open('$HERE/film.js',encoding='utf8').read()
chars=sorted(set(c for c in s if ord(c)>127)|set('0123456789/·:.,!?-~…% mDXkg'))
print(urllib.parse.quote(''.join(chars)))")
get() { # $1 family param, $2 out file
  [ -s "$D/$2" ] && [ -z "$FORCE" ] && return 0
  URL=$(curl -fsSL -A "Mozilla/5.0" "https://fonts.googleapis.com/css2?family=$1&text=$TXT" | grep -o 'https://[^)]*' | head -1)
  curl -fsSL -o "$D/$2" "$URL"; echo "fonts/$2"
}
get "Black+Han+Sans" BlackHanSans-sub.ttf
get "Jua" Jua-sub.ttf
