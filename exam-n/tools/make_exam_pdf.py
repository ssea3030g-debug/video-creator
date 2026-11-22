#!/usr/bin/env python3
"""문항 md(정답과 해설 포함) + 지문 md → 모의고사 v2 양식 PDF (A4 2단, 고딕, 머리말·결재란·쪽번호, 정답·해설 쪽).
HTML → Chromium(Playwright, node) 인쇄 → pypdf/reportlab으로 머리말·하단 덧씌우기.
사용: python3 -I tools/make_exam_pdf.py <문항.md> <지문.md> <출력.pdf> "<제목>" "<세트 지시문>" [그림.png]
필요: fonts-noto-cjk fonts-nanum, node playwright, pypdf, reportlab
문항 md 규칙: '**번호. 발문 [배점점]**' 줄, 선지 '① ...', <보기>는 '> ' 인용 블록, '# 정답과 해설' 이후는 해설.
"""
import re, sys, os, base64, html as H, subprocess, tempfile, shutil
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FD = "/usr/share/fonts/truetype/nanum/"
pdfmetrics.registerFont(TTFont("GB", FD + "NanumGothicBold.ttf"))
pdfmetrics.registerFont(TTFont("G", FD + "NanumGothic.ttf"))
pdfmetrics.registerFont(TTFont("WQY", "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", subfontIndex=0))
HAS_HAND = ord("☞") in TTFont("WQYx", "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", subfontIndex=0).face.charToGlyph

CSS = """
@page { size: A4; margin: 23mm 11mm 21mm 11mm; }
html { font-family: 'Noto Sans CJK KR', sans-serif; font-size: 8.9pt; }
body { margin: 0; line-height: 1.5; text-align: justify; word-break: break-all; }
.cols { column-count: 2; column-gap: 8mm; column-fill: auto; }
.one { column-count: 1; }
table.hd { column-span: all; width: 100%; border-collapse: collapse; margin: 0 0 7px; font-size: 9.2pt; }
table.hd td { border: 1pt solid #000; text-align: center; padding: 3px 2px; height: 26px; }
.inst { border: .9pt solid #000; padding: 4px 6px; margin-bottom: 7px; line-height: 1.8; text-align: left; }
.dg { display: inline-block; border: .9pt solid #000; width: 1.25em; text-align: center; line-height: 1.15; }
.set { font-weight: 700; margin: 3px 0 4px; }
.psg { border: .85pt solid #000; padding: 4px 6px 5px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.psg p { margin: 0; text-indent: .9em; }
.psg img.fig { float: right; width: 37%; margin: 1px 0 3px 7px; }
.q { break-inside: avoid; margin-top: 8px; }
.qh { font-weight: 700; padding-left: 1.25em; text-indent: -1.25em; margin-bottom: 3px; }
.opt { padding-left: 1.15em; text-indent: -1.15em; margin-top: .5px; }
.bogi { position: relative; border: .75pt solid #000; margin: 10px 3px 5px; padding: 8px 7px 4px; }
.bogi .bt { position: absolute; top: -.8em; left: 0; right: 0; text-align: center; line-height: 1.3; }
.bogi .bt span { background: #fff; padding: 0 4px; }
.bogi div { text-indent: 0; }
.bogi div.f { text-indent: .9em; }
.bt2 { border-collapse: collapse; margin: 4px auto 4px; font-size: 7.6pt; line-height: 1.3; }\n.bt2 th, .bt2 td { border: .6pt solid #000; padding: 2px 3px; text-align: center; }\n.psg p.gap { margin-top: 7px; }\n.psg p.fn { font-size: 7.3pt; text-indent: 0; margin-top: 4px; }\n.ansline { margin: 7px 0 0 4px; }\n.psg p.gap { margin-top: 7px; }\n.end { text-align: right; margin-top: 12px; }
.ans h2 { font-size: 11pt; margin: 4px 0 4px; }
.ans h3 { font-size: 9.6pt; margin: 8px 0 3px; }
.ans table { border-collapse: collapse; margin: 3px 0 6px; }
.ans td { border: 1pt solid #000; text-align: center; padding: 2px 9px; font-size: 8.6pt; }
.ans td.n { font-weight: 700; }
.ans p { margin: 2px 0 3px; }
.ans ul { margin: 1px 0 4px; padding-left: 15px; }
.ans li { margin: 1px 0; }
"""

def esc(s):
    s = s.replace("<u>", "\0u\0").replace("</u>", "\0/u\0")
    s = H.escape(s, quote=False)
    s = s.replace("\0u\0", "<u>").replace("\0/u\0", "</u>")
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)

def mark(s):  # ⓐ~ⓔ, ㉠~㉤ 표시어 굵게 밑줄
    s = re.sub(r"([ⓐ-ⓔ㉠-㉤])\[([^\]]+)\]", r"<b>\1</b><u>\2</u>", s)  # ㉠[여러 낱말 구절]
    return re.sub(r"([ⓐ-ⓔ㉠-㉤])(?!<)([^\s,.)\[<]+)", r"<b><u>\1\2</u></b>", s)

def digits_box(txt):
    return "".join(f'<span class="dg">{c}</span>' for c in txt)

def question_html(qb):
    lines = [l for l in qb.strip().split("\n") if l.strip()]
    out = ['<div class="q">', f'<div class="qh">{esc(lines[0].strip().strip("*"))}</div>']
    bogi = [re.sub(r"^>\s?", "", l) for l in lines[1:] if l.startswith(">")]
    bogi = [b.replace("**< 보 기 >**", "").strip() for b in bogi]
    bogi = [re.sub(r"^- ", "", b) for b in bogi if b]
    if bogi:
        out.append('<div class="bogi"><div class="bt"><span>&lt; 보 기 &gt;</span></div>')
        i = 0
        while i < len(bogi):
            if bogi[i].startswith("|"):
                rows = []
                while i < len(bogi) and bogi[i].startswith("|"):
                    if not set(bogi[i].replace("|", "").strip()) <= set("-: "):
                        rows.append([c.strip() for c in bogi[i].strip("|").split("|")])
                    i += 1
                out.append('<table class="bt2"><tr>' + "".join(f"<th>{esc(c)}</th>" for c in rows[0]) + "</tr>" +
                           "".join("<tr>" + "".join(f"<td>{esc(c)}</td>" for c in r) + "</tr>" for r in rows[1:]) + "</table>")
                continue
            out.append(f'<div class="{"f" if i == 0 else ""}">{esc(bogi[i])}</div>'); i += 1
        out.append("</div>")
    for l in lines[1:]:
        if re.match(r"^[①②③④⑤]", l):
            out.append(f'<div class="opt">{esc(l)}</div>')
        elif l.strip() and not l.startswith(">"):
            out.append(f'<div class="ansline">{esc(l)}</div>')
    out.append("</div>")
    return "\n".join(out)

def build_exam_html(body, passage, setline, fig_b64, nq):
    ps = []
    for i, p in enumerate(passage):
        t = mark(esc(p))
        if i == 1 and fig_b64:
            t = f'<img class="fig" src="data:image/png;base64,{fig_b64}">' + t
        cls = "gap" if p.startswith(("(나)", "(다)")) else ("fn" if p.startswith("* ") else "")
        ps.append(f'<p class="{cls}">{t}</p>')
    hd = ('<table class="hd"><tr><td style="width:9.5%">실시일</td><td style="width:41%">2026년 &nbsp; 월 &nbsp; 일 &nbsp; 교시</td>'
          '<td rowspan="2" style="width:3.5%">결<br>재</td><td style="width:9%">교과주임</td><td style="width:9%">계</td>'
          '<td style="width:9%">부장</td><td style="width:9%">교감</td><td style="width:9%">교장</td></tr>'
          '<tr><td>출제자</td><td></td><td></td><td></td><td></td><td></td><td></td></tr></table>')
    inst = ('<div class="inst">※반, 번호, 이름, 과목코드(' + digits_box("01") + ')를 입력하시오.<br>'
            f'※선택형 ({nq}) 문항 ({digits_box("01")}번~{digits_box(f"{nq:02d}")}번)임.</div>')
    qs = re.split(r"(?=^\*\*\d+\. )", body, flags=re.M)[1:]
    parts = [f"<html><head><meta charset='utf-8'><style>{CSS}</style></head><body><div class='cols'>", hd, inst,
             f'<div class="set">{esc(setline)}</div>', '<div class="psg">' + "".join(ps) + "</div>"]
    parts += [question_html(q) for q in qs]
    parts.append('<div class="end">끝. 수고했습니다.</div></div></body></html>')
    return "\n".join(parts)

def build_ans_html(ans, scores=None):
    o = [f"<html><head><meta charset='utf-8'><style>{CSS}</style></head><body><div class='cols one ans'>", "<h2>정답과 해설</h2>"]
    rows = [l for l in ans.strip().split("\n") if l.startswith("|") and not set(l.replace("|", "").strip()) <= set("-: ")]
    if len(rows) >= 2:
        h = [c.strip() for c in rows[0].strip("|").split("|")]; v = [c.strip() for c in rows[1].strip("|").split("|")]
        o.append("<h3>정답표</h3><table><tr>" + "".join(f'<td class="n">{x}</td>' for x in h) + "</tr><tr>" +
                 "".join(f"<td>{x}</td>" for x in v) + "</tr></table>")
    if scores:
        o.append("<h3>배점표</h3><table><tr>" + "".join(f'<td class="n">{i}</td>' for i in range(1, len(scores) + 1)) + "</tr><tr>" +
                 "".join(f"<td>{s}</td>" for s in scores) + "</tr></table>")
    o.append("<h3>해설</h3>")
    inul = False
    for l in ans.strip().split("\n"):
        l = l.rstrip()
        if not l or l.startswith("|") or l.startswith("---"): continue
        if l.startswith("- "):
            if not inul: o.append("<ul>"); inul = True
            o.append(f"<li>{esc(l[2:])}</li>")
        else:
            if inul: o.append("</ul>"); inul = False
            o.append(f"<p>{esc(l)}</p>")
    if inul: o.append("</ul>")
    o.append("</div></body></html>")
    return "\n".join(o)

def chrome_pdf(html_path, pdf_path):
    js = ("const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();"
          f"await p.goto('file://{html_path}');await p.pdf({{path:'{pdf_path}',format:'A4',printBackground:true,preferCSSPageSize:true}});await b.close();}})();")
    subprocess.run(["node", "-e", js], check=True, cwd=os.path.dirname(html_path))

def overlay(src, dst, title, badge_mode, two_col, last_note):
    r = PdfReader(src); n = len(r.pages); W, Hh = 595.276, 841.89
    tmp = dst + ".ov.pdf"; c = canvas.Canvas(tmp, pagesize=(W, Hh))
    for pg in range(1, n + 1):
        c.setFont("GB", 19); c.drawCentredString(W / 2, Hh - 43, title)
        bw = 36 if badge_mode == "num" else 40
        c.setLineWidth(.9); c.roundRect(W - 30.5 - bw, Hh - 56, bw, 17, 6, stroke=1, fill=0)
        c.setFont("GB", 9); c.drawCentredString(W - 30.5 - bw / 2, Hh - 50, f"{pg}/{n}" if badge_mode == "num" else "교사용")
        c.setLineWidth(1.6); c.line(30.5, Hh - 59.5, W - 30.5, Hh - 59.5)
        if two_col:  # 1쪽은 결재칸 표 아래(Hh-105)부터, 나머지는 머리말 선 아래부터
            c.setLineWidth(.6); c.line(W / 2, Hh - (105 if pg == 1 else 61), W / 2, 62)
        c.setFont("G", 8.6)
        c.drawString(40, 43, "이 시험문제의 저작권은 학교에 있습니다.")
        c.drawString(40, 31, "저작권법에 의해 보호받는 저작물이므로 전재와 복제는 금지되며, 이를 어길 시 저작권법에 의거 처벌될 수 있습니다.")
        if last_note and pg < n:
            c.setFont("WQY" if HAS_HAND else "G", 8.6); c.drawRightString(W - 31, 43, "☞다음 면에 계속" if HAS_HAND else "다음 면에 계속")
        c.showPage()
    c.save()
    ov = PdfReader(tmp); w = PdfWriter()
    for i, p in enumerate(r.pages):
        p.merge_page(ov.pages[i]); w.add_page(p)
    with open(dst, "wb") as f: w.write(f)
    os.remove(tmp)

def build(qmd, pmd, out, title, setline, fig=None):
    body, _, ans = open(qmd, encoding="utf-8").read().partition("# 정답과 해설")
    passage = open(pmd, encoding="utf-8").read().split("\n\n", 1)[1].strip().split("\n\n")
    nq = len(re.findall(r"^\*\*\d+\. ", body, flags=re.M))
    fig_b64 = base64.b64encode(open(fig, "rb").read()).decode() if fig else None
    d = tempfile.mkdtemp()
    open(f"{d}/q.html", "w", encoding="utf-8").write(build_exam_html(body, passage, setline, fig_b64, nq))
    scores = re.findall(r"^\*\*\d+\. .*?\[([\d.]+)점\]", body, flags=re.M)
    open(f"{d}/a.html", "w", encoding="utf-8").write(build_ans_html(ans, scores))
    chrome_pdf(f"{d}/q.html", f"{d}/q0.pdf"); chrome_pdf(f"{d}/a.html", f"{d}/a0.pdf")
    overlay(f"{d}/q0.pdf", f"{d}/q1.pdf", title, "num", True, True)
    overlay(f"{d}/a0.pdf", f"{d}/a1.pdf", title + " 정답·해설", "teacher", False, False)
    w = PdfWriter()
    for f in (f"{d}/q1.pdf", f"{d}/a1.pdf"):
        for p in PdfReader(f).pages: w.add_page(p)
    with open(out, "wb") as f: w.write(f)
    shutil.rmtree(d)

if __name__ == "__main__":
    a = sys.argv[1:]
    build(a[0], a[1], a[2], a[3], a[4], a[5] if len(a) > 5 else None)
    print("ok", a[2])
