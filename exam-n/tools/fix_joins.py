#!/usr/bin/env python3
"""fix_joins.py <md> 'A|B|s' ...  : 'A\n\nB'(또는 'A\nB')를 띄움(s)/붙임(j)으로 잇는다. 'X=>Y'는 단순 치환(공백 외 글자 변경 시 경고)."""
import sys,re
p=sys.argv[1]; s=open(p,encoding="utf-8").read(); before=re.sub(r"\s","",s)
for a in sys.argv[2:]:
    if "=>" in a:
        x,y=a.split("=>"); assert s.count(x)==1,("치환 대상 수",x,s.count(x)); s=s.replace(x,y); continue
    A,B,c=a.split("|"); pat=re.escape(A)+r"\n+"+re.escape(B); m=re.findall(pat,s)
    assert len(m)==1,("찾기 실패",A,B,len(m)); s=re.sub(pat,A+(" " if c=="s" else "")+B,s)
open(p,"w",encoding="utf-8").write(s)
after=re.sub(r"\s","",s)
print("ok" if after==before else "글자 변경됨(의도한 치환인지 확인)",p)
