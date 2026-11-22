#!/usr/bin/env python3
"""check_hard.py — 난이도 상향 프로토콜의 스크립트 신호(S1~S4)와 형식 수치를 한 번에 점검한다. 토큰 0.

사용:
  python3 -I check_hard.py <문항.md> --passage <지문.md> [--key 24135… | --answers <정답표.md>]
                           [--cards <설계카드.md>] [--part 인문|법|과학|예술] [--thr 0.6] [--json]
  (여러 세트가 한 파일이면 --passage 를 세트 머리글 `## SET n | … | s1.md`의 파일명 기준으로
   찾을 수 있게 --passage-dir <지문 폴더> 를 줄 수도 있다.)

신호(걸리면 재작성 후보):
  S1 지문 복사도  : 정답 선지 3-gram이 지문 한 문장에 담긴 비율 ≥ thr  ("가장 적절한 것"·배점 2.7↑·긴 선지만)
  S2 극단어 오답  : 강한 극단어("아무런·전혀·오직·~에만…")가 오답에 2개 이상, 또는 정답 선지에만 있음
  S3 길이 단서    : 회차에서 '긍정 발문' 정답 최장 비율 > 50% (문항별 순위 1위·±35%·파트 길이대는 참고로만 출력)
  S4 기법 분포    : (--cards) 같은 문항 오답 기법 중복, 회차 앞참뒤거짓 비율 > 40%, 근거 한 곳뿐
  L  난이도 정직화: 해설 `난이도: L? (A B C D E, 합n)` 태그가 5축 합과 어긋남, L3+ 비율
"""
import argparse, collections, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from examlib import (CIRC, HARD_RE, SOFT_RE, grams, key_from_string, level_from_sum, norm,
                     parse_key, parse_levels, parse_questions, split_sentences)

BANDS = {"인문": (80, 86), "법": (55, 64), "과학": (55, 68), "예술": (37, 47)}  # 공백 제외 평균 글자 수
TECH = [  # 기법 키워드 -> 분류 (핵심 틀 4장)
    ("앞참뒤거짓", ["앞참", "앞절 참", "앞은 맞", "뒷절", "뒤가 틀", "고리 하나"]),
    ("주체·귀속", ["귀속", "주체", "맞바꿈", "맞바꾸", "인물", "학자 교체", "이식", "대상 바꿔"]),
    ("방향", ["방향", "반전", "뒤집"]),
    ("한정어·조건", ["한정", "정도", "조건", "극단", "~만으로", "만으로", "모두"]),
    ("범주", ["범주", "혼동", "용어 쌍", "유의어"]),
    ("없는 기제", ["없는", "가짜", "기제", "근거 없는"]),
    ("직관값", ["직관", "계산"]),
    ("자리 바꾼 참말", ["참말", "자리 바꾼", "다른 제도", "다른 대상"]),
]


def classify(tok):
    for name, kws in TECH:
        if any(k in tok for k in kws):
            return name
    return "기타"


def best_overlap(opt, sents):
    g = grams(opt)
    if not g:
        return 0.0, ""
    best, bs = 0.0, ""
    for s in sents:
        v = len(g & grams(s)) / len(g)
        if v > best:
            best, bs = v, s
    return best, bs


def load_sets_passages(qs, args):
    """문항 → 지문 문장 리스트."""
    cache = {}

    def get(path):
        if path not in cache:
            cache[path] = split_sentences(open(path, encoding="utf-8").read())
        return cache[path]

    out = {}
    for q in qs:
        path = args.passage
        if not path and args.passage_dir and q["set"]:
            path = os.path.join(args.passage_dir, q["set"]["passage"])
        out[q["n"]] = get(path) if path and os.path.exists(path) else None
    return out


def parse_cards(text):
    cards = {}
    for line in text.splitlines():
        m = re.search(r"\bQ(\d+)\b", line)
        if not m or "오답 기법" not in line:
            continue
        n = int(m.group(1))
        seg = line.split("오답 기법", 1)[1].lstrip(":： ")
        seg = re.split(r"\s\|\s", seg, maxsplit=1)[0]
        toks = [t for t in re.split(r"[①②③④⑤]|,|;|·|/", seg) if t.strip()]
        ground = ""
        gm = re.search(r"근거\s*[:：]\s*([^|]+)", line)
        if gm:
            ground = gm.group(1).strip()
        cards[n] = {"techs": [classify(t) for t in toks], "ground": ground, "raw": line.strip()}
    return cards


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("questions")
    ap.add_argument("--passage")
    ap.add_argument("--passage-dir")
    ap.add_argument("--key")
    ap.add_argument("--answers")
    ap.add_argument("--cards")
    ap.add_argument("--part", choices=list(BANDS))
    ap.add_argument("--thr", type=float, default=0.6)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    qtext = open(args.questions, encoding="utf-8").read()
    qs = parse_questions(qtext)
    if not qs:
        sys.exit("문항을 찾지 못했습니다. 문항 머리글 `**N. 발문 [x.x점]**`과 선지 ①~⑤ 한 줄씩 형식인지 확인하세요.")
    nums = [q["n"] for q in qs]
    atext = open(args.answers, encoding="utf-8").read() if args.answers else qtext
    if args.key:
        key = key_from_string(args.key, nums)
    else:
        key = parse_key(atext)
        if not key and args.answers is None:
            key = parse_key(qtext)
    missing = [n for n in nums if n not in key]
    if missing:
        sys.exit(f"정답키가 없는 문항: {missing} (--key 또는 --answers 로 주세요)")
    levels = parse_levels(atext)
    passages = load_sets_passages(qs, args)
    cards = parse_cards(open(args.cards, encoding="utf-8").read()) if args.cards else {}

    rows, flags = [], collections.defaultdict(list)
    info = collections.defaultdict(list)  # 참고(문항별 신호로 쓰기엔 기준점에서도 흔한 것)
    for q in qs:
        n, o, a = q["n"], q["opts"], key[q["n"]]
        L = [len(norm(x)) for x in o]
        mean = sum(L) / 5
        rank = sorted(L, reverse=True).index(L[a - 1]) + 1
        out35 = [i + 1 for i, x in enumerate(L) if abs(x - mean) > 0.35 * mean]
        vocab = mean < 30 or (("ⓐ" in q["stem"] or "㉠" in q["stem"]) and re.search(r"의미|바꿔|문맥", q["stem"]))
        r = {"n": n, "score": q["score"], "neg": q["neg"], "key": a, "mean": round(mean), "rank": rank,
             "boggi": bool(q["boggi"]), "vocab": bool(vocab)}

        # S3 길이 — 기준점(중간고사) 실측: 정답 최장 50%(긍정 38%), ±35% 이탈 다수 → 문항별 신호가 아니라 참고.
        #   회차 단위로 '긍정 발문 정답 최장 비율 > 50%'만 신호(아래 요약). '않은' 발문은 정답(거짓)이 길어지는 경향이 있어 분리.
        if rank == 1 and not vocab and not q["neg"]:
            info[n].append("S3 긍정 발문인데 정답이 가장 긴 선지")
        if out35 and not vocab:
            info[n].append(f"S3 길이 ±35% 이탈 {out35}")
        if args.part and not vocab:
            lo, hi = BANDS[args.part]
            if mean < lo * 0.75 or mean > hi * 1.3:
                info[n].append(f"S3 파트 길이대({args.part} {lo}~{hi}자) 이탈: 평균 {round(mean)}자")

        # S1 지문 복사도 (정답 선지 vs 지문 문장)
        sents = passages.get(n)
        if sents:
            ov = [best_overlap(x, sents)[0] for x in o]
            wrong = [v for i, v in enumerate(ov) if i != a - 1]
            r["s1"] = round(ov[a - 1], 2)
            r["s1_wrong_mean"] = round(sum(wrong) / 4, 2)
            if (not q["neg"]) and (q["score"] or 3) >= 2.7 and mean >= 30 and ov[a - 1] >= args.thr:
                flags[n].append(f"S1 정답 선지가 지문 한 문장에 {ov[a - 1]:.0%} 담김(≥{args.thr:.0%})")
            if (not q["neg"]) and mean >= 30 and ov[a - 1] - max(wrong) >= 0.25 and ov[a - 1] >= 0.45:
                flags[n].append(f"S1 정답만 지문 복사도가 높음({ov[a - 1]:.0%} vs 오답 최대 {max(wrong):.0%})")

        # S2 극단어
        hard = [len(HARD_RE.findall(x)) for x in o]
        soft = [len(SOFT_RE.findall(x)) for x in o]
        r["ext"] = [i + 1 for i, c in enumerate(hard) if c]
        if q["neg"]:
            if hard[a - 1] and not any(h for i, h in enumerate(hard) if i != a - 1):
                flags[n].append("S2 극단어가 정답 선지에만 있음")
        else:
            wrong_ext = [i + 1 for i, c in enumerate(hard) if c and i != a - 1]
            if len(wrong_ext) >= 2:
                flags[n].append(f"S2 극단어 오답 {len(wrong_ext)}개 {wrong_ext}")
        if sum(soft) >= 4 and not q["neg"]:
            r["soft"] = sum(soft)

        # 난이도 태그 정직화
        lv = levels.get(n)
        if lv:
            L_tag, axes, tot, ded = lv
            real = sum(axes)
            r["L"] = max(1, level_from_sum(real) - ded)
            if tot is not None and tot != real:
                flags[n].append(f"L 합 표기 {tot} ≠ 5축 합 {real}")
            if max(1, level_from_sum(real) - ded) != L_tag:
                flags[n].append(f"L 태그 L{L_tag} ≠ 5축 합 {real}(감점 {ded})의 L{max(1, level_from_sum(real) - ded)}")
        rows.append(r)

        # S4 카드
        c = cards.get(n)
        if c:
            dup = [k for k, v in collections.Counter(c["techs"]).items() if v >= 2 and k != "기타"]
            if dup:
                flags[n].append(f"S4 오답 기법 중복: {dup}")
            if c["ground"] and not re.search(r"[+,·/＋]|및|와 | 와|과 |\d.*\d", c["ground"]):
                flags[n].append("S4 근거가 한 곳뿐으로 보임(L1)")

    # 회차 요약
    tot_q = len(rows)
    pos = [r for r in rows if not r["vocab"] and not r["neg"]]
    neg = [r for r in rows if not r["vocab"] and r["neg"]]
    pos_longest = sum(1 for r in pos if r["rank"] == 1)
    neg_longest = sum(1 for r in neg if r["rank"] == 1)
    dist = collections.Counter(r["key"] for r in rows)
    ks = [r["key"] for r in rows]
    runs = [i + 1 for i in range(len(ks) - 2) if ks[i] == ks[i + 1] == ks[i + 2]]
    summ = {
        "문항수": tot_q,
        "배점합": round(sum(r["score"] or 0 for r in rows), 1),
        "정답분포": {CIRC[k - 1]: dist.get(k, 0) for k in range(1, 6)},
        "정답 3연속 시작 번호": runs,
        "정답이 가장 긴 비율 — 긍정 발문(어휘 제외)": f"{pos_longest}/{len(pos)} = {pos_longest / (len(pos) or 1):.0%} (기준점 38%, 신호 기준 50% 초과)",
        "정답이 가장 긴 비율 — '않은' 발문(참고)": f"{neg_longest}/{len(neg)} = {neg_longest / (len(neg) or 1):.0%} (기준점 54%)",
        "발문 적절하지 않은 것": f"{sum(1 for r in rows if r['neg'])}/{tot_q}",
        "<보기> 문항": sum(1 for r in rows if r["boggi"]),
    }
    if len(pos) >= 4 and pos_longest / len(pos) > 0.50:
        summ["!! S3"] = "긍정 발문 정답 최장 비율 50% 초과 → 길이 단서(재작성 후보: 정답이 가장 긴 긍정 발문 문항)"
    lvs = [r["L"] for r in rows if "L" in r]
    if lvs:
        summ["5축 합 기준 L 분포"] = {f"L{k}": lvs.count(k) for k in range(1, 5)}
        summ["L3 이상"] = f"{sum(1 for x in lvs if x >= 3)}/{len(lvs)} = {sum(1 for x in lvs if x >= 3) / len(lvs):.0%} (목표 55%+)"
    if cards:
        allt = [t for c in cards.values() for t in c["techs"]]
        if allt:
            share = allt.count("앞참뒤거짓") / len(allt)
            summ["오답 기법 중 앞참뒤거짓"] = f"{share:.0%} (목표 40% 이하)"
            if share > 0.40:
                summ["!! S4"] = "앞참뒤거짓 비율 40% 초과"

    if args.json:
        print(json.dumps({"summary": summ, "rows": rows, "flags": flags}, ensure_ascii=False, indent=1))
        return
    print(f"{'번호':>3} {'배점':>4} {'발문':<3} {'정답':<2} {'평균':>4} {'순위':>2} {'S1복사':>6} {'극단어':<8} L  신호")
    for r in rows:
        n = r["n"]
        print(f"{n:>3} {r['score'] if r['score'] is not None else '-':>4} "
              f"{'않은' if r['neg'] else '적절':<3} {CIRC[r['key'] - 1]:<2} {r['mean']:>4} {r['rank']:>2} "
              f"{(str(r['s1']) if 's1' in r else '-'):>6} {','.join(map(str, r['ext'])) or '-':<8} "
              f"{('L' + str(r['L'])) if 'L' in r else '- ':<2} {len(flags[n]) and '⚑' + str(len(flags[n])) or ''}")
    print()
    for k, v in summ.items():
        print(f"{k}: {v}")
    if flags:
        print("\n신호 상세 (걸린 문항은 최대 1회 재작성 후보):")
        for n in sorted(flags):
            for f in flags[n]:
                print(f"  Q{n}: {f}")
    else:
        print("\n걸린 신호 없음.")
    if info:
        print("\n참고(기준점에서도 흔해 문항별 재작성 근거로 쓰지 않음):")
        for n in sorted(info):
            for f in info[n]:
                print(f"  Q{n}: {f}")
    print("\n(이 스크립트는 형식·표면 신호만 본다. 정답 오류·복수 정답은 blind_solve.py와 직접 대조로 확인.)")


if __name__ == "__main__":
    main()
