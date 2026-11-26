#!/usr/bin/env python3
"""diff_pdf_md.py — 앱에 올라간 시험지 PDF와 작업용 md가 같은 문항인지 대조한다(기준은 항상 앱 PDF).
사용: python3 -I diff_pdf_md.py <앱 PDF> <작업 md> [--tmp <임시폴더>]
출력: 발문·선지·<보기>·배점이 다른 문항 번호. 단답형은 md의 '**[단답형' 블록 개수만 비교하므로 직접 눈으로 본다.
(v2에서 md가 옛 버전이라 22·29번과 단답형이 달랐다. 보완 작업 전에 반드시 돌린다.)"""
import os, re, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from examlib import parse_questions

def norm(s): return re.sub(r"[\s\W_]", "", s)

def main():
    a = sys.argv[1:]
    pdf, md = a[0], a[1]
    tmp = a[a.index("--tmp") + 1] if "--tmp" in a else tempfile.mkdtemp()
    subprocess.run([sys.executable, "-I", os.path.join(os.path.dirname(os.path.abspath(__file__)), "import_exam.py"), "pdf", pdf, tmp], check=True, capture_output=True)
    P = {q["n"]: q for q in parse_questions(open(os.path.join(tmp, "questions.md"), encoding="utf-8").read())}
    text = open(md, encoding="utf-8").read().split("# 정답과 해설")[0]
    M = {q["n"]: q for q in parse_questions(text)}
    bad = []
    for n in sorted(P):
        p, m = P[n], M.get(n)
        if m is None: bad.append((n, "md에 없음")); continue
        why = []
        if norm(p["stem"]) != norm(m["stem"]): why.append("발문")
        if p["score"] != m["score"]: why.append(f"배점 {p['score']}≠{m['score']}")
        o = [i + 1 for i in range(5) if norm(p["opts"][i])[:40] != norm(m["opts"][i])[:40]]
        if o: why.append(f"선지 {o}")
        if why: bad.append((n, ", ".join(why)))
    print(f"앱 PDF {len(P)}문항 / md {len(M)}문항")
    print("다른 문항:", bad if bad else "없음")
    print("※ 선지 ⑤가 쪽 머리말·꼬리말로 어긋나 보일 수 있다. 발문이 다르거나 선지 4개 이상이 다르면 실제로 다른 판이다.")

if __name__ == "__main__":
    main()
