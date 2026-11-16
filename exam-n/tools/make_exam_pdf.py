#!/usr/bin/env python3
"""문항 md(정답과 해설 포함) + 지문 md → 중간고사 형식(A4 2단) PDF.
사용: python3 -I tools/make_exam_pdf.py <문항.md> <지문.md> <출력.pdf> "<제목>" "<세트 지시문>" [그림.png]
필요: reportlab, fonts-nanum (apt-get install -y fonts-nanum)
문항 md 규칙: '**번호. 발문 [배점점]**' 줄, 선지 '① ...', <보기>는 '> ' 인용 블록, '# 정답과 해설' 이후는 해설.
"""
import re, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table,
                                TableStyle, KeepTogether, Image, PageBreak, FrameBreak)

FD = "/usr/share/fonts/truetype/nanum/"
pdfmetrics.registerFont(TTFont("Myeongjo", FD + "NanumMyeongjo.ttf"))
pdfmetrics.registerFont(TTFont("MyeongjoB", FD + "NanumMyeongjoBold.ttf"))
pdfmetrics.registerFont(TTFont("Gothic", FD + "NanumGothic.ttf"))
pdfmetrics.registerFont(TTFont("GothicB", FD + "NanumGothicBold.ttf"))
import glob
_wq = (glob.glob("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc") or glob.glob("/usr/share/fonts/**/wqy-zenhei*.ttc", recursive=True))
HANJA = None
if _wq:
    pdfmetrics.registerFont(TTFont("Hanja", _wq[0], subfontIndex=0)); HANJA = "Hanja"
pdfmetrics.registerFontFamily("Myeongjo", normal="Myeongjo", bold="MyeongjoB", italic="Myeongjo", boldItalic="MyeongjoB")
pdfmetrics.registerFontFamily("Gothic", normal="Gothic", bold="GothicB", italic="Gothic", boldItalic="GothicB")

def esc(s):
    s = s.replace("<u>", "\0u\0").replace("</u>", "\0/u\0")
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    s = s.replace("\0u\0", "<u>").replace("\0/u\0", "</u>")
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    if HANJA:
        s = re.sub(r"([\u4e00-\u9fff\u3400-\u4dbf]+)", r'<font name="Hanja">\1</font>', s)
    return s

# 원문자 ⓐ~ⓔ, ㉠~㉤ 는 굵게+밑줄(지문 표시)
def mark_passage(s):
    return re.sub(r"([ⓐ-ⓔ㉠-㉤])(\S+)", r"<b><u>\1\2</u></b>", s)

BODY = ParagraphStyle("body", fontName="Myeongjo", fontSize=8.6, leading=12.6, alignment=TA_JUSTIFY, wordWrap="CJK")
PBODY = ParagraphStyle("pbody", fontName="Myeongjo", fontSize=8.6, leading=12.6, alignment=TA_JUSTIFY, wordWrap="CJK", firstLineIndent=9)
OPT = ParagraphStyle("opt", parent=BODY, leftIndent=11, firstLineIndent=-11, spaceAfter=1.6)
Q = ParagraphStyle("q", parent=BODY, fontName="GothicB", fontSize=8.8, leading=12.8, spaceBefore=8, spaceAfter=3)
SET = ParagraphStyle("set", parent=BODY, fontName="GothicB", fontSize=9, leading=13, spaceAfter=3)
BOGI = ParagraphStyle("bogi", parent=BODY, fontSize=8.3, leading=12)
HEAD = ParagraphStyle("head", parent=BODY, fontName="GothicB", fontSize=9.4, leading=14, spaceBefore=10, spaceAfter=3)

def build(qmd, pmd, out, title, setline, fig=None):
    q_text = open(qmd, encoding="utf-8").read()
    body, _, ans = q_text.partition("# 정답과 해설")
    passage = open(pmd, encoding="utf-8").read().split("\n\n", 1)[1].strip().split("\n\n")
    W, H = A4
    M, GAP, TOP, BOT = 14 * mm, 8 * mm, 30 * mm, 17 * mm
    cw = (W - 2 * M - GAP) / 2
    ch = H - TOP - BOT

    class NC(canvas.Canvas):
        def __init__(s, *a, **k):
            canvas.Canvas.__init__(s, *a, **k); s._saved = []
        def showPage(s):
            s._saved.append(dict(s.__dict__)); s._startPage()
        def save(s):
            n = len(s._saved)
            for st in s._saved:
                s.__dict__.update(st); s.chrome(n); canvas.Canvas.showPage(s)
            canvas.Canvas.save(s)
        def chrome(s, n):
            pg = s._pageNumber
            s.setFont("GothicB", 14.5); s.drawString(M + 4 * mm, H - 16 * mm, title)
            s.roundRect(W - M - 16 * mm, H - 18.2 * mm, 16 * mm, 6.4 * mm, 3, stroke=1, fill=0)
            s.setFont("GothicB", 10); s.drawCentredString(W - M - 8 * mm, H - 16.4 * mm, f"{pg}/{n}")
            s.setLineWidth(0.9); s.line(M, H - 21 * mm, W - M, H - 21 * mm)
            s.setLineWidth(0.5); s.line(W / 2, BOT, W / 2, H - TOP + 3 * mm)
            s.setFont("Myeongjo", 7.2)
            s.drawString(M + 2 * mm, 11 * mm, "연습용 문항입니다. 지문의 저작권은 원저작권자에게 있으며, 무단 전재와 복제를 금합니다.")
            if pg < n: s.drawRightString(W - M, 11 * mm, "다음 면에 계속")
            s.setLineWidth(0.4); s.line(M, 14 * mm, W - M, 14 * mm)

    frames = [Frame(M, BOT, cw, ch, 0, 0, 0, 0, id="L"), Frame(M + cw + GAP, BOT, cw, ch, 0, 0, 0, 0, id="R")]
    doc = BaseDocTemplate(out, pagesize=A4, leftMargin=M, rightMargin=M, topMargin=TOP, bottomMargin=BOT,
                          title=title, author="")
    doc.addPageTemplates([PageTemplate(id="two", frames=frames)])
    S = []
    S.append(Paragraph(esc(setline), SET))
    rows = []
    for i, p in enumerate(passage):
        rows.append([Paragraph(mark_passage(esc(p)), PBODY)])
        if i == 1 and fig:
            im = Image(fig); r = im.imageWidth / im.imageHeight; wd = cw * 0.6
            im.drawWidth, im.drawHeight = wd, wd / r; im.hAlign = "CENTER"
            rows.append([im])
    t = Table(rows, colWidths=[cw])
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.8, colors.black), ("LEFTPADDING", (0, 0), (-1, -1), 4),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 2.2),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2)]))
    S.append(t)

    qs = re.split(r"(?=^\*\*\d+\. )", body, flags=re.M)[1:]
    for qb in qs:
        lines = [l for l in qb.strip().split("\n") if l.strip()]
        head = lines[0]; fl = []
        fl.append(Paragraph(esc(head.strip("*").replace("**", "")), Q))
        bogi = [l[2:] if l.startswith("> ") else l[1:] for l in lines[1:] if l.startswith(">")]
        if bogi:
            cell = [Paragraph("&lt; 보 기 &gt;", ParagraphStyle("bt", parent=BOGI, alignment=1, fontName="Myeongjo"))]
            for b in bogi:
                b = b.replace("**< 보 기 >**", "").strip()
                if not b: continue
                b = re.sub(r"^- ", "", b)
                cell.append(Paragraph(esc(b), BOGI))
            bt = Table([[cell]], colWidths=[cw - 4])
            bt.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.7, colors.black), ("LEFTPADDING", (0, 0), (-1, -1), 5),
                                    ("RIGHTPADDING", (0, 0), (-1, -1), 5), ("TOPPADDING", (0, 0), (-1, -1), 3),
                                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
            fl += [bt, Spacer(1, 4)]
        for l in lines[1:]:
            if re.match(r"^[①②③④⑤]", l):
                fl.append(Paragraph(esc(l), OPT))
        S.append(KeepTogether(fl))

    S.append(PageBreak())
    S.append(Paragraph("정답과 해설", ParagraphStyle("h", parent=SET, fontSize=12, spaceAfter=6)))
    for l in ans.strip().split("\n"):
        l = l.rstrip()
        if not l or l.startswith("---"): continue
        if l.startswith("|"):
            if set(l.replace("|", "").strip()) <= set("-: "): continue
            cells = [c.strip() for c in l.strip("|").split("|")]
            S.append(Paragraph("  ".join(cells), ParagraphStyle("tb", parent=BODY, fontName="GothicB", spaceAfter=2)))
        elif l.startswith("- "):
            S.append(Paragraph("· " + esc(l[2:]), OPT))
        else:
            S.append(Paragraph(esc(l), ParagraphStyle("ex", parent=BODY, spaceAfter=3)))
    doc.build(S, canvasmaker=NC)

if __name__ == "__main__":
    a = sys.argv[1:]
    build(a[0], a[1], a[2], a[3], a[4], a[5] if len(a) > 5 else None)
    print("ok", a[2])
