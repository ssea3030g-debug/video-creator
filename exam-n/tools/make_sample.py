#!/usr/bin/env python3
"""맛보기 PDF: 원본 시험지 앞 N쪽에 워터마크를 얹고 안내 쪽을 붙인다.
사용: make_sample.py <원본.pdf> <출력.pdf> <쪽수> "<시험지 이름>" "<전체판 안내 한 줄>" """
import sys,io
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import Color
src_p,out,N,name,full=sys.argv[1],sys.argv[2],int(sys.argv[3]),sys.argv[4],sys.argv[5]
pdfmetrics.registerFont(TTFont("GB","/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"))
src=PdfReader(src_p); w=PdfWriter()
for i in range(N):
    pg=src.pages[i]; W=float(pg.mediabox.width); H=float(pg.mediabox.height)
    b=io.BytesIO(); c=canvas.Canvas(b,pagesize=(W,H))
    c.saveState(); c.translate(W/2,H/2); c.rotate(35)
    c.setFillColor(Color(0.85,0.1,0.1,alpha=0.13)); c.setFont("GB",64); c.drawCentredString(0,30,"맛보기 SAMPLE")
    c.setFont("GB",22); c.drawCentredString(0,-15,"무단 복제·배포 금지"); c.restoreState()
    c.setFillColor(Color(0.6,0.6,0.6,alpha=0.30)); c.setFont("GB",9)
    for y in range(60,int(H),140):
        for x in range(30,int(W),190):
            c.saveState(); c.translate(x,y); c.rotate(35); c.drawString(0,0,f"{name} · 맛보기"); c.restoreState()
    c.save(); b.seek(0); pg.merge_page(PdfReader(b).pages[0]); w.add_page(pg)
W=float(src.pages[0].mediabox.width); H=float(src.pages[0].mediabox.height)
b=io.BytesIO(); c=canvas.Canvas(b,pagesize=(W,H)); c.setFont("GB",22); c.drawCentredString(W/2,H*0.62,"맛보기는 여기까지입니다")
c.setFont("GB",13)
for k,t in enumerate([full,"정답표 · 배점표 · 전 문항 해설(근거 지점 · 함정 · 난이도) 포함","※ 이 파일은 맛보기용이며 무단 복제·배포를 금지합니다."]):
    c.drawCentredString(W/2,H*0.55-k*24,t)
c.save(); b.seek(0); w.add_page(PdfReader(b).pages[0]); w.write(out); print("ok",out,len(w.pages),"쪽")
