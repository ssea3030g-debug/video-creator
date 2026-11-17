#!/usr/bin/env python3
"""세트(지문+문항) 여러 개를 이어 붙인 모의고사 PDF (v2 양식). make_exam_pdf.py의 조판 함수를 재사용한다.
사용: make_exam_multi.py <문항.md> <정답해설.md> <지문폴더> <출력.pdf> "<제목>" <그림.png>
문항 md: '## SET n | [a~b, 단답형 k] | setN.md | fig' 줄로 세트를 구분하고, 그 아래 문항을 둔다(단답형은 '**[단답형 k] ...**')."""
import sys, os, re, base64, tempfile, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_exam_pdf as M
from pypdf import PdfReader, PdfWriter

def split_sets(text):
    out = []
    for blk in re.split(r"(?=^## SET )", text, flags=re.M)[1:]:
        head, _, rest = blk.partition("\n")
        parts = [x.strip() for x in head[len("## SET"):].split("|")]
        out.append(dict(n=parts[0], rng=re.sub(r",\s*단답형\s*\d+", "", parts[1]), file=parts[2], fig=(parts[3] if len(parts) > 3 else ""), body=rest))
    return out

M.CSS += '.figw{display:block;width:92%;margin:4px auto 6px}'

def exam_html(qmd, pdir, fig_path):
    sets = split_sets(open(qmd, encoding="utf-8").read())
    fig_b64 = base64.b64encode(open(fig_path, "rb").read()).decode() if fig_path else None
    nq = sum(len(re.findall(r"^\*\*\d+\. ", s["body"], flags=re.M)) for s in sets)
    nd = sum(len(re.findall(r"^\*\*\[단답형", s["body"], flags=re.M)) for s in sets)
    hd = ('<table class="hd"><tr><td style="width:9.5%">실시일</td><td style="width:41%">2026년 &nbsp; 월 &nbsp; 일 &nbsp; 교시</td>'
          '<td rowspan="2" style="width:3.5%">결<br>재</td><td style="width:9%">교과주임</td><td style="width:9%">계</td>'
          '<td style="width:9%">부장</td><td style="width:9%">교감</td><td style="width:9%">교장</td></tr>'
          '<tr><td>출제자</td><td></td><td></td><td></td><td></td><td></td><td></td></tr></table>')
    inst = ('<div class="inst">※반, 번호, 이름, 과목코드(' + M.digits_box("01") + ')를 입력하시오.<br>'
            f'※선택형 ({nq}) 문항 ({M.digits_box("01")}번~{M.digits_box(f"{nq:02d}")}번)임.<br>'
            f'※단답형 ({nd}) 문항은 해당 지문의 선택형 문항 뒤에 있음.</div>')
    parts = [f"<html><head><meta charset='utf-8'><style>{M.CSS}</style></head><body><div class='cols'>", hd, inst]
    for s in sets:
        passage = open(os.path.join(pdir, s["file"]), encoding="utf-8").read().strip().split("\n\n")
        ps = []
        for i, p in enumerate(passage):
            t = M.mark(M.esc(p))
            if s["fig"] == "fig" and i == 1 and fig_b64:
                t = f'<img class="fig" src="data:image/png;base64,{fig_b64}">' + t
            elif s["fig"].startswith("fig="):
                fp, at = s["fig"][4:].rsplit("@", 1)
                if i == int(at):
                    b = base64.b64encode(open(fp, "rb").read()).decode()
                    t = f'<img class="figw" src="data:image/png;base64,{b}">' + t
            cls = "gap" if p.startswith(("(나)", "(다)")) else ("fn" if p.startswith("* ") else "")
            ps.append(f'<p class="{cls}">{t}</p>')
        parts.append(f'<div class="set">{M.esc(s["rng"])} 다음 글을 읽고 물음에 답하시오.</div>')
        parts.append('<div class="psg">' + "".join(ps) + "</div>")
        for q in re.split(r"(?=^\*\*(?:\d+\. |\[단답형))", s["body"], flags=re.M)[1:]:
            parts.append(M.question_html(q))
    parts.append('<div class="end">끝. 수고했습니다.</div></div></body></html>')
    return "\n".join(parts), nq

def answer_html(amd, scores):
    t = open(amd, encoding="utf-8").read().replace("# 정답과 해설", "", 1)
    o = [f"<html><head><meta charset='utf-8'><style>{M.CSS}</style></head><body><div class='cols one ans'>", "<h2>정답과 해설</h2>", "<h3>정답표</h3>"]
    lines = t.strip().split("\n"); i = 0; extra = []; hs = []
    while i < len(lines):
        l = lines[i].rstrip()
        if l.startswith("|"):
            blk = []
            while i < len(lines) and lines[i].startswith("|"):
                if not set(lines[i].replace("|", "").strip()) <= set("-: "): blk.append([c.strip() for c in lines[i].strip("|").split("|")])
                i += 1
            for k in range(0, len(blk) - 1, 2):
                o.append("<table><tr>" + "".join(f'<td class="n">{x}</td>' for x in blk[k]) + "</tr><tr>" + "".join(f"<td>{x}</td>" for x in blk[k + 1]) + "</tr></table>")
            continue
        if l.startswith("단답형 "): extra.append(l)
        elif l.strip(): hs.append(l)
        i += 1
    for e in extra: o.append(f"<p>{M.esc(e)}</p>")
    if scores:
        o.append("<h3>배점표</h3>")
        for k in range(0, len(scores), 11):
            ch = scores[k:k + 11]
            o.append("<table><tr>" + "".join(f'<td class="n">{k + j + 1}</td>' for j in range(len(ch))) + "</tr><tr>" + "".join(f"<td>{x}</td>" for x in ch) + "</tr></table>")
        o.append("<p>단답형 1: 2점(각 1점), 단답형 2: 3점(각 1점)</p>")
    o.append("<h3>해설</h3>")
    inul = False
    for l in hs:
        if l.startswith("- "):
            if not inul: o.append("<ul>"); inul = True
            o.append(f"<li>{M.esc(l[2:])}</li>")
        else:
            if inul: o.append("</ul>"); inul = False
            o.append(f"<p>{M.esc(l)}</p>")
    if inul: o.append("</ul>")
    o.append("</div></body></html>")
    return "\n".join(o)

def main(qmd, amd, pdir, out, title, fig):
    d = tempfile.mkdtemp()
    qh, nq = exam_html(qmd, pdir, fig)
    scores = re.findall(r"^\*\*\d+\. .*?\[([\d.]+)점\]", open(qmd, encoding="utf-8").read(), flags=re.M)
    open(f"{d}/q.html", "w", encoding="utf-8").write(qh)
    open(f"{d}/a.html", "w", encoding="utf-8").write(answer_html(amd, scores))
    M.chrome_pdf(f"{d}/q.html", f"{d}/q0.pdf"); M.chrome_pdf(f"{d}/a.html", f"{d}/a0.pdf")
    M.overlay(f"{d}/q0.pdf", f"{d}/q1.pdf", title, "num", True, True)
    M.overlay(f"{d}/a0.pdf", f"{d}/a1.pdf", title + " 정답·해설", "teacher", False, False)
    w = PdfWriter()
    for f in (f"{d}/q1.pdf", f"{d}/a1.pdf"):
        for p in PdfReader(f).pages: w.add_page(p)
    with open(out, "wb") as f: w.write(f)
    print("ok", out, "문제 쪽수", len(PdfReader(f"{d}/q1.pdf").pages), "해설 쪽수", len(PdfReader(f"{d}/a1.pdf").pages))
    shutil.rmtree(d)

if __name__ == "__main__":
    a = sys.argv[1:]
    main(a[0], a[1], a[2], a[3], a[4], a[5] if len(a) > 5 else None)
