#!/usr/bin/env python3
"""import_exam.py — 2단 편집 시험지 PDF / 모의고사 md를 examlib 형식(세트 머리글·**N.** 발문·선지 ①~⑤)으로 바꾼다.

  pdf  : python3 -I import_exam.py pdf <시험지.pdf> <출력폴더>
         → <출력폴더>/questions.md(문항), <출력폴더>/ps<세트>.md(지문). pdftotext 필요. 단답형은 건너뛴다.
  pdfpassages : 같은 방식으로 지문만 뽑는다(문항은 다른 md에서 올 때): ... pdfpassages <pdf> <출력폴더>
  md   : python3 -I import_exam.py md <모의고사.md> <출력.md>
         → '### [범위] …' 머리글을 '## SET n | [범위] | ps{n}.md'로 바꾸고 정답과 해설 이후는 잘라 낸다.

저작물 주의: 변환 결과(특히 학교 시험지)는 /tmp 등 저장소 밖에만 둔다. 이 스크립트는 본문을 저장하지 않는다.
"""
import os, re, subprocess, sys

CIRC = "①②③④⑤"
FOOT = ("이 시험문제의", "저작권법에", "이를 어길", "☞다음 면에", "학년도 제")
SET_RE = re.compile(r"^\[(\d+)~(\d+)(?:\s*,\s*단답형\s*\d+)?\]\s*다음 글")


def pdf_stream(pdf, cols=297):
    """페이지마다 왼쪽 단 → 오른쪽 단 순으로 읽은 줄 목록."""
    info = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout
    npages = int(re.search(r"Pages:\s*(\d+)", info).group(1))
    lines = []
    for p in range(1, npages + 1):
        # 정답·해설 쪽부터는 문항이 아니므로 읽지 않는다(선지 기호가 해설에도 나온다)
        head = subprocess.run(["pdftotext", "-f", str(p), "-l", str(p), pdf, "-"], capture_output=True, text=True).stdout[:300]
        if "정답과 해설" in head or "정답·해설" in head:
            break
        for x, w in ((0, cols + 1), (cols, 300)):
            t = subprocess.run(["pdftotext", "-f", str(p), "-l", str(p), "-x", str(x), "-y", "0", "-W", str(w),
                                "-H", "842", pdf, "-"], capture_output=True, text=True).stdout
            for ln in t.splitlines():
                ln = ln.replace("\f", "").strip()
                if ln and not ln.startswith(FOOT):
                    lines.append(ln)
    return lines


def split_pdf(lines):
    sets, cur, q, mode, expect = [], None, None, None, None
    for ln in lines:
        m = SET_RE.match(ln)
        if m:
            cur = {"range": (int(m.group(1)), int(m.group(2))), "passage": [], "qs": []}
            sets.append(cur)
            q, mode, expect = None, "passage", int(m.group(1))
            continue
        if cur is None:
            continue
        if ln.startswith("[단답형"):
            q, mode = None, "skip"
            continue
        m = re.match(r"^(\d+)\.\s+(.*)$", ln)
        if m and int(m.group(1)) == expect and expect <= cur["range"][1]:
            q = {"n": expect, "stem": [m.group(2)], "boggi": [], "opts": []}
            cur["qs"].append(q)
            mode, expect = "stem", expect + 1
            continue
        if mode == "passage":
            cur["passage"].append(ln)
        elif mode == "skip" or q is None:
            continue
        elif ln[0] in CIRC and len(q["opts"]) < 5:
            q["opts"].append(ln[1:].strip())
            mode = "opts"
        elif mode == "opts":
            q["opts"][-1] += " " + ln
        elif mode == "stem" and not re.search(r"점\s*\]", " ".join(q["stem"])):
            q["stem"].append(ln)
        else:
            mode = "boggi"
            if not re.fullmatch(r"<\s*보\s*기\s*>", ln):
                q["boggi"].append(ln)
    for s in sets:
        for q in s["qs"]:
            q["stem"] = " ".join(q["stem"])
    return sets


def fmt_md(sets):
    out = []
    for i, s in enumerate(sets, 1):
        out.append(f"## SET {i} | [{s['range'][0]}~{s['range'][1]}] | ps{i}.md\n")
        for q in s["qs"]:
            sc = re.search(r"\[\s*(\d+(?:\.\d+)?)\s*점\s*\]", q["stem"])
            stem = re.sub(r"\s*\[\s*\d+(?:\.\d+)?\s*점\s*\]", "", q["stem"]).strip()
            out.append(f"**{q['n']}.** {stem} [{sc.group(1) if sc else '2.5'}점]\n")
            if q["boggi"]:
                out.append("> <보기>\n" + "\n".join("> " + b for b in q["boggi"]) + "\n")
            out.extend(f"{CIRC[k]} {t}" for k, t in enumerate(q["opts"]))
            out.append("")
    return "\n".join(out)


def cmd_pdf(pdf, outdir, passages_only=False):
    os.makedirs(outdir, exist_ok=True)
    sets = split_pdf(pdf_stream(pdf))
    for i, s in enumerate(sets, 1):
        open(os.path.join(outdir, f"ps{i}.md"), "w", encoding="utf-8").write("\n".join(s["passage"]) + "\n")
    if not passages_only:
        open(os.path.join(outdir, "questions.md"), "w", encoding="utf-8").write(fmt_md(sets))
    print(f"세트 {len(sets)}개, 선택형 {sum(len(s['qs']) for s in sets)}문항 → {outdir}")
    for s in sets:
        print("  ", s["range"], "문항", [q["n"] for q in s["qs"]], "선지수", [len(q["opts"]) for q in s["qs"]])


def cmd_md(src, dst):
    t = open(src, encoding="utf-8").read().split("# 정답과 해설")[0]
    k = 0

    def sub(m):
        nonlocal k
        k += 1
        return f"## SET {k} | [{m.group(1)}] | ps{k}.md"

    t = re.sub(r"^###\s*\[([^\]]*)\].*$", sub, t, flags=re.M)
    t = re.sub(r"<!--PSG:[^>]*-->\n?", "", t)
    open(dst, "w", encoding="utf-8").write(t)
    print(f"세트 {k}개 → {dst}")


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) >= 3 and a[0] == "pdf":
        cmd_pdf(a[1], a[2])
    elif len(a) >= 3 and a[0] == "pdfpassages":
        cmd_pdf(a[1], a[2], passages_only=True)
    elif len(a) >= 3 and a[0] == "md":
        cmd_md(a[1], a[2])
    else:
        sys.exit(__doc__)
