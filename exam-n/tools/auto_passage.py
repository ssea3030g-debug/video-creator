#!/usr/bin/env python3
"""2단 PDF 열 텍스트에서 지문을 자동 복원(줄 잇기·문단 나누기)하고 글자 동일성을 검증한다.
사용: auto_passage.py <out.md> <열파일:시작줄:끝줄> [...]   (줄 번호 1부터, 끝 포함)
불확실한 줄 잇기는 stderr로 보고한다. 원 표식(ⓐ, ㉠ 등)은 지운다(STRIP=0이면 유지)."""
import sys,re,os
out=sys.argv[1]; L=[]; SEG=[]
for si,spec in enumerate(sys.argv[2:]):
    f,a,b=spec.rsplit(":",2); ls=open(f,encoding="utf-8").read().split("\n")
    L+=ls[int(a)-1:int(b)]; SEG+=[si]*(int(b)-int(a)+1)
noise=re.compile(r"^\s*(\d{1,2}|국어|국어 영역|영역|고2|고2 +국어|국어 영역 +고2|━+.*|)\s*$")
keep=[i for i,x in enumerate(L) if not noise.match(x.replace("\x0c",""))]
SEG=[SEG[i] for i in keep]; L=[L[i].rstrip().replace("\x0c","") for i in keep]
ind=[len(x)-len(x.lstrip(" ")) for x in L]
from collections import Counter
bs={g:Counter(ind[i] for i in range(len(L)) if SEG[i]==g).most_common(1)[0][0] for g in set(SEG)}
base=[bs[SEG[i]] for i in range(len(L))]
PS=[ (i>0 and base[i]<ind[i]<base[i]+5 and not L[i].lstrip().startswith("*")) for i in range(len(L))]
FC=[ ind[i]>=base[i]+5 for i in range(len(L))]
L=[x.strip() for x in L]
raw="".join(L)
if os.environ.get("STRIP","1")=="1":
    L=[re.sub(r"[ⓐⓑⓒⓓⓔⒶⒷ㉠㉡㉢㉣㉤] ?","",x) for x in L]
tok=set(w for x in L for w in re.findall(r"\S+",x))
body=[len(x) for x in L if not x.startswith("*")]
W=sorted(body)[len(body)*3//4] if body else 30
end=set("는은을를이가에의와과도로고며서다면게지인적나데만든까라께며서여요")
import json,urllib.request
def llm(pairs):
    K=open(os.path.expanduser("~/.freellmapi-session/unified-key")).read().strip()
    q="한국어 글의 줄바꿈 지점이다. 각 번호마다 '앞|뒤'를 이어 쓸 때 띄어쓰기가 필요하면 s, 한 낱말이 끊긴 것이라 붙여야 하면 j. 표준 띄어쓰기 기준. 설명 없이 한 줄에 하나씩 `번호 s` 또는 `번호 j` 형식으로만 답하라.\n"+"\n".join(f"{k+1}. …{a[-14:]}|{b[:14]}…" for k,(a,b) in enumerate(pairs))
    import time
    for m in ("gemini-3.5-flash","gpt-oss-120b","kimi-k2.6","gpt-oss-120b","gemini-3.5-flash-lite"):
        try:
            d=json.dumps({"model":m,"messages":[{"role":"user","content":q}],"temperature":0}).encode()
            r=urllib.request.Request("http://localhost:3001/v1/chat/completions",d,{"Authorization":"Bearer "+K,"Content-Type":"application/json"})
            c=json.load(urllib.request.urlopen(r,timeout=180))["choices"][0]["message"]["content"]
            got=dict((int(n),v) for n,v in re.findall(r"(?m)^\D{0,3}(\d+)\D{0,3}?([sj])\b",c))
            a=[got.get(k+1) for k in range(len(pairs))]
            if all(a): print("llm",m,file=sys.stderr); return a
            print("llm short",m,sum(x is not None for x in a),len(pairs),file=sys.stderr)
        except Exception as e: print("llm err",m,str(e)[:80],file=sys.stderr); time.sleep(10)
    return None
pairs=[];kinds=[]
for i,x in enumerate(L[:-1]):
    nx=L[i+1]
    if FC[i+1]: kinds.append("?"); pairs.append((x,nx)); continue
    if nx.startswith("*") or PS[i+1] or re.match(r"^\((가|나|다)\)",nx) or re.fullmatch(r"\((가|나|다)\)",x) or (x.startswith("*") and not FC[i+1]):
        kinds.append("P")
    else: kinds.append("?"); pairs.append((x,nx))
if os.environ.get("SHOW"):
    for k,(a,b) in enumerate(pairs): print(f"{k+1}:{a.split()[-1] if a.split() else ''}|{b.split()[0] if b.split() else ''}",end="  ")
    print(); sys.exit()
dec=list(os.environ["DEC"]) if os.environ.get("DEC") else (llm(pairs) if os.environ.get("LLM","1")=="1" else None)
assert dec is None or len(dec)==len(pairs),(len(dec),len(pairs))
parts=[];unsure=[];k=0
for i,x in enumerate(L):
    parts.append(x)
    if i==len(L)-1: break
    nx=L[i+1]
    if kinds[i]=="P": parts.append("\n\n"); continue
    if dec: parts.append(" " if dec[k]=="s" else ""); k+=1; continue
    A=x.split()[-1] if x.split() else ""; B=nx.split()[0] if nx.split() else ""
    AB=re.sub(r"[.,“”‘’()]","",A+B)
    if any(t.strip(".,“”‘’()")==AB for t in tok): parts.append("")
    elif re.search(r"[.,?!”’)」]$",A): parts.append(" ")
    elif A and A[-1] in end and len(A)>1: parts.append(" "); unsure.append(("s",A,B))
    else: parts.append(""); unsure.append(("j",A,B))
txt="".join(parts).strip()
txt=re.sub(r"\((가|나|다)\)\n\n",r"(\1) ",txt)
assert re.sub(r"\s","",txt)==re.sub(r"\s","",re.sub(r"[ⓐⓑⓒⓓⓔⒶⒷ㉠㉡㉢㉣㉤]","",raw) if os.environ.get("STRIP","1")=="1" else raw)
open(out,"w",encoding="utf-8").write(txt+"\n")
print("ok",out,"문단",txt.count("\n\n")+1,"글자",len(re.sub(r"\s","",txt)),file=sys.stderr)
for u in unsure: print(" ",u[0],u[1],"|",u[2],file=sys.stderr)
