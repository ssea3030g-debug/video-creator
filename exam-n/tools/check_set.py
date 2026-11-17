#!/usr/bin/env python3
"""check_set.py <문항.md> <정답문자열 33자리(1~5)> : 문항별 선지 평균 길이·정답 길이 순위·±35% 이탈, 정답 분포, 배점 합."""
import re,sys,collections,statistics as st
q=open(sys.argv[1],encoding="utf-8").read(); key=[int(c) for c in sys.argv[2]]
lg=top2=0; rows=[]; sc=0
for blk in re.split(r"(?=^\*\*(?:\d+\.|\[단답형))",q,flags=re.M):
    m=re.match(r"\*\*(\d+)\.",blk)
    if not m: continue
    n=int(m.group(1)); sc+=float(re.search(r"\[(\d\.\d)점\]",blk).group(1))
    L=[len(re.sub(r"\s","",x.group(1))) for x in re.finditer(r"^[①②③④⑤] (.+)$",blk,re.M)]
    a=L[key[n-1]-1]; rk=sorted(L,reverse=True).index(a)+1; lg+=rk==1; top2+=rk<=2
    mu=st.mean(L); out=[i+1 for i,x in enumerate(L) if abs(x-mu)>0.35*mu]
    rows.append(f"{n:>2} 평균{mu:5.0f} 정답순위{rk} 범위{min(L)}-{max(L)}"+(f" ±35%이탈:{out}" if out else ""))
print("\n".join(rows))
print("정답이 가장 긴:",lg,f"({lg/len(key):.0%})","1·2위:",top2,"| 분포:",sorted(collections.Counter(key).items()),"| 배점합:",round(sc,1))
