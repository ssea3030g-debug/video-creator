#!/usr/bin/env python3
"""blind_solve.py — 무료 모델(FreeLLMAPI 등 OpenAI 호환 엔드포인트)로 문항을 맹검 풀이한다. 서브에이전트 대신 쓰는 값싼 검수.

두 모드를 한 번에 돈다(S5·S6 신호):
  nopassage : 지문 없이 발문·<보기>·선지만 준다(문항별 1회). 정답을 확신하며 맞히면 → 소거로 풀림(B축 0) 후보.
  passage   : 지문 + 문항(세트별 1회). 정답과 다르거나 '정답 없음/둘 이상'/낮은 확신 → 오류 의심.
정답표·해설·난이도 태그·배점은 모델에 보내지 않는다(자기 평가 문구에 판정이 끌리는 문제 방지).

사용:
  python3 -I blind_solve.py <문항.md> --passage <지문.md> [--key 24135… | --answers <정답표.md>]
                            [--mode both|nopassage|passage] [--model gemini-3.5-flash] [--out 결과.json]
  --dry-run   : 네트워크 없이 보낼 프롬프트와 대략 토큰 수만 출력
환경: FREELLM_BASE(기본 http://localhost:3001/v1), FREELLM_KEY(기본 ~/.freellmapi-session/unified-key)
외부 무료 서비스는 입력을 학습에 쓸 수 있으므로 지문 원문과 문항만 보낸다(지침서·해설지 금지).
"""
import argparse, collections, json, os, re, sys, time, urllib.error, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from examlib import CIRC, key_from_string, parse_key, parse_questions

SYSTEM = ("너는 한국 고등학교 국어(독서) 시험을 푸는 수험생이다. 주어진 문항만 보고 풀이한다. "
          "반드시 JSON 한 개만 출력한다: "
          '{"answer": 1~5 중 하나, 또는 0(정답이 없다고 판단) 또는 -1(정답이 둘 이상이라고 판단), '
          '"confidence": 1~5(5가 가장 확신), "evidence": "정답 근거 한두 문장(지문을 줬다면 지문 문장 인용)"}')


def fmt_q(q, with_no=True):
    s = f"{q['n']}. {q['stem']}" if with_no else q["stem"]
    if q["boggi"]:
        s += "\n<보기>\n" + "\n".join(q["boggi"])
    s += "\n" + "\n".join(f"{CIRC[i]} {t}" for i, t in enumerate(q["opts"]))
    return s


def call(base, key, model, system, user, retries=6):
    body = json.dumps({"model": model, "temperature": 0,
                       "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]},
                      ensure_ascii=False).encode()
    last = None
    for i in range(retries):
        req = urllib.request.Request(base.rstrip("/") + "/chat/completions", data=body, method="POST",
                                     headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.load(r)
            return d["choices"][0]["message"]["content"], d.get("model", model)
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}"
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(min(60, 4 * 2 ** i))
                continue
            return None, f"{last} {e.read()[:120]!r}"
        except (urllib.error.URLError, TimeoutError) as e:
            last = str(e)
            time.sleep(min(60, 4 * 2 ** i))
    return None, f"재시도 소진: {last}"   # 한 문항 실패가 전체를 죽이지 않게 한다(결과에 '실패'로 남김)


def parse_json_obj(text):
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def norm_answer(v):
    if isinstance(v, str):
        v = v.strip()
        v = CIRC.index(v) + 1 if v in CIRC else int(v) if re.fullmatch(r"-?\d", v) else None
    return v if isinstance(v, int) and -1 <= v <= 5 else None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("questions")
    ap.add_argument("--passage")
    ap.add_argument("--passage-dir")
    ap.add_argument("--key")
    ap.add_argument("--answers")
    ap.add_argument("--mode", choices=["both", "nopassage", "passage"], default="both")
    ap.add_argument("--model", default="gemini-3.5-flash")
    ap.add_argument("--only", help="풀 문항 번호(쉼표), 기본 전부")
    ap.add_argument("--out")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--conf-high", type=int, default=4)
    ap.add_argument("--sleep", type=float, default=0, help="호출 사이 대기(초). 429가 잦으면 2~4")
    args = ap.parse_args()

    qtext = open(args.questions, encoding="utf-8").read()
    qs = parse_questions(qtext)
    if args.only:
        want = {int(x) for x in args.only.split(",")}
        qs = [q for q in qs if q["n"] in want]
    if not qs:
        sys.exit("문항을 찾지 못했습니다.")
    if args.key:
        key = key_from_string(args.key, [q["n"] for q in parse_questions(qtext)])
    else:
        src = open(args.answers, encoding="utf-8").read() if args.answers else qtext
        key = parse_key(src)

    base = os.environ.get("FREELLM_BASE", "http://localhost:3001/v1")
    kp = os.path.expanduser("~/.freellmapi-session/unified-key")
    apikey = os.environ.get("FREELLM_KEY") or (open(kp).read().strip() if os.path.exists(kp) else "")
    if not args.dry_run and not apikey:
        sys.exit("API 키가 없습니다(FREELLM_KEY 또는 ~/.freellmapi-session/unified-key). FreeLLMAPI가 안 떠 있으면 "
                 "이 단계는 건너뛰고 '검증 약함/미실시'로 보고하세요.")

    # 지문 (세트별)
    def passage_for(q):
        path = args.passage or (os.path.join(args.passage_dir, q["set"]["passage"]) if args.passage_dir and q["set"] else None)
        return open(path, encoding="utf-8").read().strip() if path and os.path.exists(path) else None

    results = collections.defaultdict(dict)  # n -> mode -> dict
    models_used = set()
    sent_chars = 0

    def solve(prompt, mode, items):
        nonlocal sent_chars
        sent_chars += len(prompt)
        if args.dry_run:
            print(f"----- [{mode}] 문항 {[q['n'] for q in items]} / {len(prompt)}자 -----\n{prompt}\n")
            return
        if args.sleep:
            time.sleep(args.sleep)
        text, used = call(base, apikey, args.model, SYSTEM, prompt)
        if text is None:
            print(f"  [실패] 문항 {[q['n'] for q in items]} {mode}: {used}", file=sys.stderr)
            return ""
        models_used.add(used)
        return text

    if args.mode in ("both", "nopassage"):
        for q in qs:
            prompt = "지문은 제공되지 않는다. 문항만 보고 가장 가능성 높은 답을 골라라.\n\n" + fmt_q(q, with_no=False)
            text = solve(prompt, "지문 없이", [q])
            if text is not None:
                results[q["n"]]["nopassage"] = parse_json_obj(text) or {"raw": text[:200]}
    if args.mode in ("both", "passage"):
        groups = collections.OrderedDict()
        for q in qs:
            groups.setdefault(q["set"]["id"] if q["set"] else 0, []).append(q)
        for sid, items in groups.items():
            ptxt = passage_for(items[0])
            if not ptxt:
                print(f"[세트 {sid}] 지문 파일을 찾지 못해 passage 모드를 건너뜀(--passage 지정)", file=sys.stderr)
                continue
            prompt = ("아래 [지문]을 읽고 각 문항을 푼다. 문항마다 JSON 한 개를 만들고 전체를 JSON 배열로 출력한다: "
                      '[{"n": 문항번호, "answer": …, "confidence": …, "evidence": …}, …]\n\n[지문]\n' + ptxt +
                      "\n\n[문항]\n" + "\n\n".join(fmt_q(q) for q in items))
            text = solve(prompt, "지문 주고", items)
            if text is None:
                continue
            m = re.search(r"\[.*\]", text, re.S)
            try:
                arr = json.loads(m.group(0)) if m else []
            except json.JSONDecodeError:
                arr = []
            by = {int(x.get("n", -9)): x for x in arr if isinstance(x, dict) and str(x.get("n", "")).lstrip("-").isdigit()}
            for q in items:
                results[q["n"]]["passage"] = by.get(q["n"]) or {"raw": text[:200]}

    if args.dry_run:
        print(f"[dry-run] 보낼 총 글자 수 약 {sent_chars}자(토큰은 대략 글자 수의 0.7~1배)")
        return

    weak = any("lite" in m.lower() for m in models_used)
    print(f"사용 모델: {', '.join(sorted(models_used)) or '-'}" + ("  ⚠ lite 모델이 풀었음 → '검증 약함'으로 보고" if weak else ""))
    print(f"{'번호':>3} {'정답':<3} | {'지문 없이':<12} | {'지문 주고':<12} | 판정")
    summary = []
    for q in qs:
        n = q["n"]
        a = key.get(n)
        cells, verdict = [], []
        for mode in ("nopassage", "passage"):
            r = results[n].get(mode)
            if not r or "raw" in r:
                cells.append("실패/없음")
                continue
            ans, conf = norm_answer(r.get("answer")), r.get("confidence")
            cells.append(f"{CIRC[ans - 1] if ans and ans > 0 else ('정답없음' if ans == 0 else '둘이상' if ans == -1 else '?')}"
                         f"(확신{conf})")
            r["_ans"], r["_conf"] = ans, conf if isinstance(conf, int) else 0
        rn, rp = results[n].get("nopassage"), results[n].get("passage")
        if a and rn and "_ans" in rn and rn["_ans"] == a and rn["_conf"] >= args.conf_high:
            verdict.append("S5 지문 없이도 확신하고 맞힘 → 소거로 풀림 후보(B축 0)")
        if rp and "_ans" in rp:
            if rp["_ans"] in (0, -1):
                verdict.append("S6 모델이 '정답 없음/둘 이상' 주장 → 직접 대조")
            elif a and rp["_ans"] != a:
                verdict.append("S6 정답과 다름 → 직접 대조(복수 정답·근거 모호 의심)")
            elif a and rp["_conf"] <= 2:
                verdict.append("S6 정답은 맞혔으나 확신 낮음 → 모호 가능성")
            elif a and rp["_conf"] >= 5 and rn and rn.get("_ans") != a:
                verdict.append("지문 필요 + 고확신 → 정상 범위")
        print(f"{n:>3} {CIRC[a - 1] if a else '?':<3} | {cells[0]:<12} | {cells[1]:<12} | {'; '.join(verdict) or '-'}")
        summary.append({"n": n, "key": a, "nopassage": rn, "passage": rp, "verdict": verdict})
    print("\n※ S5는 5지선다 우연 정답(20%)이 있어 '확신 높음 + 맞힘'일 때만 신호로 본다. 약한 모델이면 '검증 약함'.")
    if args.out:
        json.dump({"models": sorted(models_used), "results": summary}, open(args.out, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        print(f"결과 저장: {args.out}")


if __name__ == "__main__":
    main()
