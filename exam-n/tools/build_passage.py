#!/usr/bin/env python3
"""줄 번호별 판정(j=붙임, s=띄움, P=문단 끝, E=끝)으로 추출 텍스트를 지문 문단으로 복원하고,
공백을 뺀 글자가 원본과 완전히 같은지 검증한다. 사용: build_passage.py <clean.txt> <판정문자열> <출력.md> [제목줄]"""
import sys, re
src, D, out = sys.argv[1], sys.argv[2], sys.argv[3]
L = open(src, encoding="utf-8").read().split("\n")
n = len(D)
assert n <= len(L), f"판정 {n}개 > 줄 {len(L)}개"
rest = L[n:]
import os
assert os.environ.get("PARTIAL") or all(re.match(r"^\x0c?(독서 고난도 모의고사 v2|\d+\/14|\s*)$", x) for x in rest), f"남는 줄이 잡음이 아님: {rest[:3]}"
parts = []
for i in range(n):
    parts.append(L[i])
    c = D[i]
    parts.append(" " if c == "s" else ("\n\n" if c == "P" else ""))
txt = "".join(parts).strip()
strip = lambda s: re.sub(r"\s+", "", s)
assert strip(txt) == strip("".join(L[:n])), "글자가 달라졌음"
open(out, "w", encoding="utf-8").write(txt + "\n")
print("ok", out, "줄", n, "문단", txt.count("\n\n") + 1, "글자", len(strip(txt)))
