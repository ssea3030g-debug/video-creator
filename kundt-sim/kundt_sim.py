#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""쿤트관 음속 시뮬레이션 — 음속으로 기체 분자의 성질과 조성을 알아낸다.

실행: python3 kundt_sim.py   → results/ 에 모듈별 PNG(300 dpi)·CSV 저장, 콘솔에 요약 표 출력.

공통 모형: v = sqrt(γ·R·T / M)   (이상기체)
  혼합: M_mix = Σ x_i M_i,  Cp_mix = Σ x_i Cp_i,  Cv = Cp − R,  γ = Cp/Cv
"""
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm

# =====================================================================
# 0. 상수 · 기체 데이터 · 가정값  (여기만 고치면 전체가 바뀐다)
# =====================================================================
R = 8.314            # 기체 상수 J/(mol·K)
N_A = 6.02214076e23  # 아보가드로 수 1/mol (SI 정의값) — 분자 1개 에너지 환산용
P_ATM = 101325.0     # 1 atm [Pa]
T_C = 22.0           # 기본 온도 [℃]

# 기체 데이터: 분자량 M [g/mol], 정압 몰열용량 Cp [J/(mol·K)], 분자 구조.
# 출처: 사용자 제공 값(상온 부근 교과서·핸드북 수준의 일반값; NIST Chemistry WebBook,
#       CRC Handbook 값과 대조해 갱신할 것). 이 딕셔너리만 고치면 모든 모듈에 반영된다.
# kind: 그림에서 마커 구분용(단원자/이원자/다원자), shape: 분자 구조 설명.
GASES = {
    "He":  dict(M=4.003,   Cp=20.79, kind="단원자", shape="단원자",         label="He"),
    "Ne":  dict(M=20.18,   Cp=20.79, kind="단원자", shape="단원자",         label="Ne"),
    "Ar":  dict(M=39.95,   Cp=20.79, kind="단원자", shape="단원자",         label="Ar"),
    "H2":  dict(M=2.016,   Cp=28.8,  kind="이원자", shape="이원자",         label="H$_2$"),
    "N2":  dict(M=28.014,  Cp=29.1,  kind="이원자", shape="이원자",         label="N$_2$"),
    "O2":  dict(M=31.999,  Cp=29.4,  kind="이원자", shape="이원자",         label="O$_2$"),
    "CO2": dict(M=44.01,   Cp=37.1,  kind="다원자", shape="선형 삼원자",    label="CO$_2$"),
    "H2O": dict(M=18.015,  Cp=33.6,  kind="다원자", shape="굽은 삼원자",    label="H$_2$O"),
    "CH4": dict(M=16.04,   Cp=35.7,  kind="다원자", shape="정사면체",       label="CH$_4$"),
    "NH3": dict(M=17.03,   Cp=35.1,  kind="다원자", shape="삼각뿔",         label="NH$_3$"),
    "SF6": dict(M=146.06,  Cp=97.0,  kind="다원자", shape="정팔면체",       label="SF$_6$"),
}

# 공기 조성(몰 %). 합이 100이 아니어도 규격화해서 쓴다.
AIR_PCT = {"N2": 78.08, "O2": 20.95, "Ar": 0.93, "CO2": 0.04}

# 실측값 — 비교(그림 표시)용으로만 쓰고 계산에 되먹이지 않는다.
EXP1 = (24.1, 345.0)            # 실험 1: (℃, m/s)
EXP2 = (50.0, 360.0)            # 실험 2: (약 50℃ → 50.0℃로 가정, m/s)
EXP3_RUNS = (267.0, 270.0, 276.0)   # 실험 3 회차별 음속 [m/s]
EXP3_MEAN = 271.0               # 실험 3 평균 [m/s]
SENSOR_CO2_PCT = 0.9            # 센서가 표시한 CO2 비율 [%]
EXP_AIR_REF = 345.0             # 모듈 1 비교용 공기 실측 [m/s]

# ---- 가정값 (측정값 아님) ----
FREQ_HZ = 1000.0                # 스피커 주파수 [Hz]
READ_ERR_CM = 0.1               # 마디 간격 읽기 오차 [cm]  → Δv = 2·f·Δd
MEAS_ERR_MS = 2.0               # 모듈 2: 음속 측정 오차 [m/s]
RH_CASES = (0.0, 0.5, 1.0)      # 모듈 4: 습도 곡선 [0~1]
RH_FROM_TO = (0.40, 0.80)       # 모듈 4: 습도 변화 구간
TUBE_L_CM = 30.0                # 모듈 6: 관 길이 [cm]
TUBE_R_CM = 2.0                 # 모듈 6: 관 반지름 [cm]
TUBE_V = 345.0                  # 모듈 6: 관 속 공기 음속 [m/s]
FREE_R0_CM = 2.0                # 모듈 6: 자유 공간 1/r 곡선의 기준 거리 [cm]
# 모듈 5: 소재별 투과 계수 k [1/min] — 임의 가정값(측정값 아님)
K_ASSUMED = {
    "스펀지·거즈 (k 큼, 가정)": 0.30,
    "투과성 낮은 소재 (k 작음, 가정)": 0.02,
}
X0_CO2 = 1.00                   # 모듈 5: 시작 시 관 속 CO2 몰분율(순수 CO2로 채웠다고 가정)
MEAS_MIN = (1.0, 3.0)           # 모듈 5: 측정에 걸리는 시간 [min]

OUT = Path(__file__).resolve().parent / "results"

# 색(Okabe-Ito, 색각 이상 안전) + 선 모양·마커를 함께 써서 색에만 의존하지 않는다.
C_BLUE, C_RED, C_GREEN, C_PURPLE, C_ORANGE, C_SKY, C_GRAY = (
    "#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9", "#555555")


# =====================================================================
# 1. 공통 함수
# =====================================================================
def setup_style():
    """흰 배경·한글 폰트·얇은 선 설정."""
    avail = {f.name for f in fm.fontManager.ttflist}
    for name in ("Malgun Gothic", "NanumGothic", "AppleGothic", "Noto Sans CJK KR"):
        if name in avail:
            plt.rcParams["font.family"] = name
            break
    else:
        print("[경고] 한글 폰트를 찾지 못했습니다. 글자가 깨질 수 있습니다.")
    plt.rcParams.update({
        "figure.facecolor": "white", "axes.facecolor": "white", "savefig.facecolor": "white",
        "axes.unicode_minus": False, "mathtext.default": "regular",
        "lines.linewidth": 1.0, "axes.linewidth": 0.7, "axes.grid": True,
        "grid.color": "#dddddd", "grid.linewidth": 0.5, "font.size": 9,
        "legend.fontsize": 8, "legend.frameon": False, "savefig.dpi": 300,
    })


def build_components():
    """혼합 계산용 성분표. 공기는 규격화한 조성에서 M, Cp를 계산해 '의사 단일 성분'으로 둔다."""
    comp = {k: dict(M=g["M"] / 1000.0, Cp=g["Cp"]) for k, g in GASES.items()}
    tot = sum(AIR_PCT.values())
    xs = {k: v / tot for k, v in AIR_PCT.items()}
    comp["AIR"] = dict(M=sum(x * comp[k]["M"] for k, x in xs.items()),
                       Cp=sum(x * comp[k]["Cp"] for k, x in xs.items()))
    return comp


COMP = build_components()


def mix(keys, xs):
    """몰분율 xs(합 1)로 섞은 기체의 (M[kg/mol], Cp, γ). xs 원소는 배열도 가능."""
    M = sum(x * COMP[k]["M"] for k, x in zip(keys, xs))
    Cp = sum(x * COMP[k]["Cp"] for k, x in zip(keys, xs))
    return M, Cp, Cp / (Cp - R)


def v_sound(M, gamma, T):
    """v = sqrt(γ R T / M), T는 켈빈, M은 kg/mol."""
    return np.sqrt(gamma * R * T / M)


def v_binary(a, b, x, T):
    """a(1−x) + b(x) 2성분 혼합 음속. x는 b의 몰분율."""
    M, _, g = mix([a, b], [1 - np.asarray(x, float), np.asarray(x, float)])
    return v_sound(M, g, T)


def v_pure(key, T):
    M, _, g = mix([key], [1.0])
    return v_sound(M, g, T)


def invert_fraction(v, a, b, T, tol=1e-10):
    """음속 v → b의 몰분율 x (구간 이분법). 반환 (x, 상태).
    v가 순수 a~순수 b 범위 밖이면 가까운 끝(0 또는 1)으로 잘라 '범위 밖'으로 표시한다."""
    grid = np.linspace(0, 1, 201)
    d = np.diff(v_binary(a, b, grid, T))
    if not (np.all(d > 0) or np.all(d < 0)):
        raise ValueError(f"{a}+{b}: 음속이 몰분율에 대해 단조가 아니어서 이분법을 쓸 수 없다")
    va, vb = float(v_binary(a, b, 0.0, T)), float(v_binary(a, b, 1.0, T))
    if v < min(va, vb):
        return (0.0 if va < vb else 1.0), "범위 밖(이론 최소 미만)"
    if v > max(va, vb):
        return (0.0 if va > vb else 1.0), "범위 밖(이론 최대 초과)"
    lo, hi = 0.0, 1.0
    inc = vb > va
    while hi - lo > tol:
        mid = 0.5 * (lo + hi)
        if (float(v_binary(a, b, mid, T)) < v) == inc:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi), "정상"


def K(tc):
    return tc + 273.15


def show(title, df, fmt="{:.3f}"):
    print(f"\n=== {title} ===")
    print(df.to_string(index=False, float_format=lambda x: fmt.format(x)))


def save_csv(df, name):
    OUT.mkdir(exist_ok=True)
    df.to_csv(OUT / name, index=False, encoding="utf-8-sig")  # 엑셀에서 한글이 깨지지 않게


def save_fig(fig, name, **kw):
    OUT.mkdir(exist_ok=True)
    fig.savefig(OUT / name, dpi=300, **kw)
    plt.close(fig)


def caption(fig, text):
    fig.text(0.5, 0.008, text, ha="center", va="bottom", fontsize=7.5, color="#444444", wrap=True)


# =====================================================================
# 모듈 0: 보고서 그림 재현 (sim_fig.png)
# =====================================================================
def module0():
    T = K(T_C)
    x = np.linspace(0, 100, 501)
    v = v_binary("AIR", "CO2", x / 100, T)
    v_air, v_co2 = float(v_binary("AIR", "CO2", 0, T)), float(v_binary("AIR", "CO2", 1, T))
    v_09 = float(v_binary("AIR", "CO2", SENSOR_CO2_PCT / 100, T))

    fig, ax = plt.subplots(figsize=(6.0, 4.3))
    ax.plot(x, v, color=C_BLUE, lw=0.9, label="이론 음속 (공기 + CO$_2$, 22.0℃)")
    ax.axvline(SENSOR_CO2_PCT, color=C_GRAY, lw=0.7, ls="--", label="센서 표시 0.9%")
    ax.axhline(EXP3_MEAN, color=C_GREEN, lw=0.7, ls="-.", label="실험 3 평균 271 m/s")
    for val, mk, i in zip(EXP3_RUNS, ("o", "s", "^"), (1, 2, 3)):
        ax.plot(SENSOR_CO2_PCT, val, mk, mfc="white", mec=C_RED, ms=5, mew=0.9, clip_on=False,
                label=f"실험 3 {i}회차 {val:.0f} m/s")
    ax.plot(SENSOR_CO2_PCT, v_09, "D", color="black", ms=3.5, label="0.9%에서의 이론값")
    ax.set_xlim(-2, 102)
    ax.set_ylim(255, 360)
    ax.set_xlabel("CO$_2$ 비율 (%)")
    ax.set_ylabel("음속 (m/s)")
    # 곡선과 겹치지 않는 빈 자리(곡선 위쪽 / 곡선 왼쪽 아래)에 직접 라벨
    ax.text(SENSOR_CO2_PCT + 2.5, 358, "센서 표시 0.9%", fontsize=7.5, va="top", color=C_GRAY)
    ax.text(22, EXP3_MEAN + 2, "실험 3 평균 271 m/s", fontsize=7.5, va="bottom", color=C_GREEN)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.17), ncol=2, columnspacing=1.2)
    save_fig(fig, "sim_fig.png", bbox_inches="tight")

    # 그림 아래 출력할 값
    x_mean, st_mean = invert_fraction(EXP3_MEAN, "AIR", "CO2", T)
    rows = [dict(항목="순수 공기 이론 음속 [m/s]", 값=v_air),
            dict(항목="순수 CO2 이론 음속 [m/s]", 값=v_co2),
            dict(항목="0.9%에서 이론 음속 [m/s]", 값=v_09),
            dict(항목="0.9%의 공기 대비 차이 [%]", 값=(v_09 / v_air - 1) * 100),
            dict(항목="271 m/s 역산 CO2 비율(평균) [%]", 값=x_mean * 100)]
    for i, val in enumerate(EXP3_RUNS, 1):
        xi, st = invert_fraction(val, "AIR", "CO2", T)
        rows.append(dict(항목=f"{val:.0f} m/s({i}회차) 역산 CO2 비율 [%] — {st}", 값=xi * 100))
    df = pd.DataFrame(rows)
    show("모듈 0: 보고서 그림 재현 (22.0℃)", df)
    save_csv(df, "module0_values.csv")
    print(f"  공기 성분 규격화 결과: M = {COMP['AIR']['M']*1000:.3f} g/mol, "
          f"γ = {mix(['AIR'], [1.0])[2]:.4f}")


# =====================================================================
# 모듈 1: 분자량과 분자 구조
# =====================================================================
def module1():
    T = K(T_C)
    Mair, _, gair = mix(["AIR"], [1.0])
    vair = v_pure("AIR", T)
    rows = []
    for key in ["AIR"] + list(GASES):
        M, Cp, g = mix([key], [1.0])
        f = 2.0 / (g - 1.0)                     # γ = 1 + 2/f
        vM, v = np.sqrt(R * T / M), float(v_sound(M, g, T))
        rows.append({
            "기체": key if key != "AIR" else "공기(혼합)",
            "분자 구조": GASES[key]["shape"] if key != "AIR" else "혼합(이원자 위주)",
            "M (g/mol)": M * 1000, "Cp": Cp, "γ": g, "자유도 f": f,
            "√(RT/M) (m/s)": vM, "√(γRT/M) (m/s)": v,
            "구조 효과 √γ": v / vM,
            "공기 대비(분자량만)": vM / np.sqrt(R * T / Mair),
            "공기 대비(γ까지)": v / vair,
        })
    df = pd.DataFrame(rows)
    show("모듈 1: 순수 기체 음속 — 분자량만 vs γ(분자 구조)까지 (22.0℃)", df)
    save_csv(df, "module1_gases.csv")
    print("  ※ H2O는 22℃·1 atm에서 순수 증기로 존재할 수 없다(포화증기압 약 2.6 kPa). 이상기체 가정의 가상값.")
    print("  ※ f는 γ에서 역산한 유효 자유도(진동 자유도는 상온에서 일부만 열림 → 다원자는 정수가 아님).")

    # CO2 공기 대비 음속비
    co2 = df[df["기체"] == "CO2"].iloc[0]
    cmp_df = pd.DataFrame([
        dict(방법="분자량만 √(M_air/M_CO2)", 음속비=co2["공기 대비(분자량만)"]),
        dict(방법="γ까지 (이론 v_CO2/v_air)", 음속비=co2["공기 대비(γ까지)"]),
        dict(방법="실측 271/345 (비교용)", 음속비=EXP3_MEAN / EXP_AIR_REF),
    ])
    show("모듈 1: CO2의 공기 대비 음속비", cmp_df, "{:.4f}")
    save_csv(cmp_df, "module1_co2_ratio.csv")

    # 그림
    style = {"단원자": (C_BLUE, "o"), "이원자": (C_RED, "s"), "다원자": (C_GREEN, "^")}
    off = {"CH4": (-6, 5, "right"), "Ne": (6, 5, "left"), "NH3": (-6, -12, "right"),
           "H2O": (6, -13, "left"),
           "N2": (-7, 5, "right"), "O2": (7, -11, "left")}
    fig, ax = plt.subplots(figsize=(8, 5.6))
    d = df[df["기체"] != "공기(혼합)"].reset_index(drop=True)
    for _, r in d.iterrows():          # 분자량만 쓴 값 → γ까지 쓴 값 연결선(구조 효과)
        ax.plot([r["M (g/mol)"]] * 2, [r["√(RT/M) (m/s)"], r["√(γRT/M) (m/s)"]],
                color="#bbbbbb", lw=0.6, zorder=1)
    ax.plot(d["M (g/mol)"], d["√(RT/M) (m/s)"], "o", mfc="white", mec=C_GRAY, ms=4, mew=0.7,
            ls="none", label="분자량만 √(RT/M)", zorder=2)
    for kind, (c, mk) in style.items():
        s = d[[GASES[k]["kind"] == kind for k in d["기체"]]]
        ax.plot(s["M (g/mol)"], s["√(γRT/M) (m/s)"], mk, color=c, ms=6, ls="none",
                label=f"{kind}: γ까지 √(γRT/M)", zorder=3)
    ar = df[df["기체"] == "공기(혼합)"].iloc[0]
    ax.plot(ar["M (g/mol)"], ar["√(γRT/M) (m/s)"], "D", color="black", ms=4, ls="none",
            label="공기(혼합)", zorder=3)
    ax.annotate("공기", (ar["M (g/mol)"], ar["√(γRT/M) (m/s)"]), xytext=(8, 7),
                textcoords="offset points", fontsize=8, ha="left")
    for _, r in d.iterrows():
        dx, dy, ha = off.get(r["기체"], (6, 4, "left"))
        ax.annotate(GASES[r["기체"]]["label"], (r["M (g/mol)"], r["√(γRT/M) (m/s)"]),
                    xytext=(dx, dy), textcoords="offset points", fontsize=8.5, ha=ha)
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlim(1.5, 250)
    ax.set_ylim(90, 2200)
    ax.set_yticks([100, 200, 300, 500, 1000, 2000])
    ax.set_yticklabels(["100", "200", "300", "500", "1000", "2000"])
    ax.set_xlabel("분자량 M (g/mol, 로그 축)")
    ax.set_ylabel("음속 (m/s, 22.0℃, 로그 축)")
    ax.set_title("같은 분자량에서도 구조(γ)가 다르면 음속이 다르다 (회색 선 = 구조 효과)", fontsize=9)
    ax.legend(loc="upper right")
    fig.tight_layout(rect=[0, 0.04, 1, 1])
    caption(fig, "이상기체 이론값. H$_2$O는 22℃에서 순수 증기로 존재할 수 없는 가상값이다.")
    save_fig(fig, "module1_molecular_weight.png")


# =====================================================================
# 모듈 2: 혼합 기체의 조성 분석 (음속 → 조성 역산)
# =====================================================================
PAIRS = [("AIR", "CO2", "공기 + CO$_2$", "공기+CO2", "-", "o", C_BLUE),
         ("AIR", "He", "공기 + He", "공기+He", "--", "s", C_RED),
         ("AIR", "SF6", "공기 + SF$_6$", "공기+SF6", "-.", "^", C_GREEN),
         ("CH4", "CO2", "CH$_4$ + CO$_2$", "CH4+CO2", ":", "D", C_PURPLE)]


def module2():
    T = K(T_C)
    x = np.linspace(0, 1, 401)
    fig, axs = plt.subplots(1, 2, figsize=(11, 4.8))
    for ax, ylim, skip_he in ((axs[0], (0, 1100), False), (axs[1], (100, 480), True)):
        for a, b, lab, _, ls, mk, c in PAIRS:
            if skip_he and b == "He":
                continue
            ax.plot(x * 100, v_binary(a, b, x, T), color=c, ls=ls, marker=mk, ms=4,
                    markevery=40, mfc="white", lw=0.9, label=lab + " (둘째 성분 증가)")
        ax.set_xlabel("둘째 성분의 몰분율 (%)")
        ax.set_ylabel("음속 (m/s)")
        ax.set_ylim(*ylim)
    axs[0].set_title("(a) 전체", fontsize=9)
    axs[1].set_title("(b) He 제외 확대", fontsize=9)
    axs[0].legend(loc="upper left")
    axs[1].legend(loc="upper right")
    fig.tight_layout(rect=[0, 0.05, 1, 1])
    caption(fig, "이상기체 이론 곡선(22.0℃). 두 성분의 음속 차이가 클수록 곡선이 가파르다 = 조성 변화에 음속이 민감하다.")
    save_fig(fig, "module2_mixtures.png")

    # 측정 오차 ±2 m/s → 조성 추정 오차
    rows = []
    for a, b, _, name, *_ in PAIRS:
        va, vb = float(v_binary(a, b, 0, T)), float(v_binary(a, b, 1, T))
        row = {"성분 쌍": name, "v(순수 첫째)": va, "v(순수 둘째)": vb, "|Δv| (m/s)": abs(vb - va)}
        warn = []
        for xr in (0.1, 0.5, 0.9):
            v0 = float(v_binary(a, b, xr, T))
            xp, sp = invert_fraction(v0 + MEAS_ERR_MS, a, b, T)
            xm, sm = invert_fraction(v0 - MEAS_ERR_MS, a, b, T)
            row[f"±{MEAS_ERR_MS:g} m/s → ±%p (x={xr:.0%})"] = abs(xp - xm) / 2 * 100
            if sp != "정상" or sm != "정상":
                warn.append(f"x={xr:.0%}")
        row["범위 밖(잘림)"] = ", ".join(warn) if warn else "-"
        rows.append(row)
    df = pd.DataFrame(rows).sort_values("|Δv| (m/s)", ascending=False).reset_index(drop=True)
    show(f"모듈 2: 음속 측정 오차 ±{MEAS_ERR_MS:g} m/s가 만드는 조성 추정 오차 (%p)", df)
    col = f"±{MEAS_ERR_MS:g} m/s → ±%p (x=50%)"
    ok = df[col].is_monotonic_increasing
    print(f"  → |Δv| 순위와 x=50% 오차 순위가 완전히 일치하는가: {ok}")
    print("    (He가 가장 정확, 공기+CO2가 가장 부정확. SF6+공기와 CH4+CO2는 |Δv|가 비슷하고 곡선이 비선형이라")
    print("     x에 따라 순위가 바뀐다: 오차는 |Δv|뿐 아니라 그 조성에서의 기울기 dv/dx에 반비례하기 때문.)")
    save_csv(df, "module2_error.csv")

    # 회차별 실측 역산
    rows = []
    for i, val in enumerate(EXP3_RUNS, 1):
        xi, st = invert_fraction(val, "AIR", "CO2", T)
        xl, _ = invert_fraction(val + MEAS_ERR_MS, "AIR", "CO2", T)
        xh, _ = invert_fraction(val - MEAS_ERR_MS, "AIR", "CO2", T)
        rows.append({"회차": i, "측정 음속 (m/s)": val, "역산 CO2 (%)": xi * 100, "상태": st,
                     f"±{MEAS_ERR_MS:g} m/s 범위 하한(%)": xl * 100,
                     f"±{MEAS_ERR_MS:g} m/s 범위 상한(%)": xh * 100})
    xm_, st = invert_fraction(EXP3_MEAN, "AIR", "CO2", T)
    rows.append({"회차": "평균", "측정 음속 (m/s)": EXP3_MEAN, "역산 CO2 (%)": xm_ * 100, "상태": st,
                 f"±{MEAS_ERR_MS:g} m/s 범위 하한(%)": invert_fraction(EXP3_MEAN + MEAS_ERR_MS, "AIR", "CO2", T)[0] * 100,
                 f"±{MEAS_ERR_MS:g} m/s 범위 상한(%)": invert_fraction(EXP3_MEAN - MEAS_ERR_MS, "AIR", "CO2", T)[0] * 100})
    df = pd.DataFrame(rows)
    show("모듈 2: 실험 3 실측 음속 → CO2 비율 역산 (공기+CO2, 22.0℃)", df)
    print("  ※ 순수 CO2의 이론 음속보다 느린 값은 100%로 잘리며 '범위 밖'으로 표시한다(이론이 실측에 맞게 조정하지 않음).")
    save_csv(df, "module2_inversion.csv")


# =====================================================================
# 모듈 3: 온도
# =====================================================================
def module3():
    Ts = np.linspace(0, 60, 241)
    f = FREQ_HZ
    va = lambda key, tc: v_pure(key, K(tc)) if key != "AIR" else v_pure("AIR", K(tc))
    v_air, v_co2, v_he = (np.array([va(k, t) for t in Ts]) for k in ("AIR", "CO2", "He"))
    lin = 331.3 + 0.606 * Ts

    fig, axs = plt.subplots(2, 2, figsize=(11, 8))
    ax = axs[0, 0]
    for v, lab, ls, c in ((v_he, "He", "--", C_RED), (v_air, "공기", "-", C_BLUE),
                          (v_co2, "CO$_2$", "-.", C_GREEN)):
        ax.plot(Ts, v, ls=ls, color=c, label=lab)
    ax.set_ylim(200, 1150)
    ax.set_title("(a) 온도에 따른 음속", fontsize=9)
    ax.set_xlabel("온도 (℃)"); ax.set_ylabel("음속 (m/s)")
    ax.legend(loc="center left", bbox_to_anchor=(0.02, 0.5))

    ax = axs[0, 1]
    ax.plot(Ts, v_air, color=C_BLUE, label="공기 이론: 정확한 √ 식")
    ax.plot(Ts, lin, color=C_ORANGE, ls="--", label="선형 근사 331.3 + 0.606·T")
    ax.plot(*EXP1, "o", mfc="white", mec=C_RED, ms=6, ls="none", label="실험 1 실측 (24.1℃, 345 m/s)")
    ax.plot(*EXP2, "s", mfc="white", mec=C_RED, ms=6, ls="none", label="실험 2 실측 (약 50℃, 360 m/s)")
    ax.set_title("(b) 공기 확대: 이론 vs 근사 vs 실측", fontsize=9)
    ax.set_xlabel("온도 (℃)"); ax.set_ylabel("음속 (m/s)")
    ax.set_ylim(325, 385)
    ax.legend(loc="upper left")

    ax = axs[1, 0]
    for v, lab, ls, c in ((v_he, "He", "--", C_RED), (v_air, "공기", "-", C_BLUE),
                          (v_co2, "CO$_2$", "-.", C_GREEN)):
        ax.plot(Ts, v / (2 * f) * 100, ls=ls, color=c, label=lab)
    ax.set_title(f"(c) 마디 간격 v/(2f), f = {f:.0f} Hz", fontsize=9)
    ax.set_xlabel("온도 (℃)"); ax.set_ylabel("마디 간격 (cm)")
    ax.legend(loc="center left", bbox_to_anchor=(0.02, 0.5))

    ax = axs[1, 1]
    for key, lab, c, mk in (("AIR", "공기", C_BLUE, "o"), ("CO2", "CO$_2$", C_GREEN, "^")):
        M, _, g = mix([key], [1.0])
        vr = np.sqrt(3 * R * K(Ts) / M)
        vs = np.array([va(key, t) for t in Ts])
        ax.plot(Ts, vr, color=c, ls="-", marker=mk, markevery=40, mfc="white", ms=4,
                label=f"{lab} 평균 제곱근 속력 √(3RT/M)")
        ax.plot(Ts, vs, color=c, ls="--", marker=mk, markevery=40, ms=4,
                label=f"{lab} 음속 √(γRT/M)")
    ax.set_ylim(150, 680)
    ax.set_title("(d) 분자 평균 속력과 음속", fontsize=9)
    ax.set_xlabel("온도 (℃)"); ax.set_ylabel("속력 (m/s)")
    ax.legend(loc="upper left", fontsize=7.5)
    fig.tight_layout(rect=[0, 0.03, 1, 1])
    caption(fig, "이론 곡선(이상기체). 실험 2의 온도는 '약 50℃'를 50.0℃로 가정했다. 실측은 비교용이며 계산에 쓰지 않았다.")
    save_fig(fig, "module3_temperature.png")

    # 표 1: 정확한 식 vs 선형 근사, 마디 간격
    rows = []
    for tc in (0, 10, 20, 22, 30, 40, 50, 60):
        ve, vl = float(va("AIR", tc)), 331.3 + 0.606 * tc
        rows.append({"T (℃)": tc, "공기 정확 (m/s)": ve, "선형 근사 (m/s)": vl,
                     "차이 근사−정확 (m/s)": vl - ve, "차이 (%)": (vl / ve - 1) * 100,
                     "CO2 (m/s)": float(va("CO2", tc)), "He (m/s)": float(va("He", tc)),
                     "마디 간격 공기 (cm)": ve / (2 * f) * 100,
                     "마디 간격 CO2 (cm)": float(va("CO2", tc)) / (2 * f) * 100,
                     "마디 간격 He (cm)": float(va("He", tc)) / (2 * f) * 100})
    df = pd.DataFrame(rows)
    show("모듈 3: 온도별 음속 · 선형 근사와의 차이 · 마디 간격", df)
    save_csv(df, "module3_temperature.csv")

    # 표 2: 실측과 이론 비교(되먹임 없음)
    rows = []
    for name, (tc, vm) in (("실험 1", EXP1), ("실험 2", EXP2)):
        vt = float(va("AIR", tc))
        rows.append({"실험": name, "T (℃)": tc, "실측 (m/s)": vm, "이론 (m/s)": vt,
                     "실측−이론 (m/s)": vm - vt, "차이 (%)": (vm / vt - 1) * 100,
                     "선형 근사 (m/s)": 331.3 + 0.606 * tc})
    df = pd.DataFrame(rows)
    show("모듈 3: 실측 vs 이론 (공기)", df)
    save_csv(df, "module3_exp_compare.csv")

    # 표 3: 분자 운동
    rows = []
    for tc in (0, 22, 50, 60):
        T = K(tc)
        for key, lab in (("AIR", "공기"), ("CO2", "CO2")):
            M, _, g = mix([key], [1.0])
            vr, vs = float(np.sqrt(3 * R * T / M)), float(v_sound(M, g, T))
            rows.append({"T (℃)": tc, "기체": lab, "평균 병진 운동에너지/분자 (10^-21 J)": 1.5 * R / N_A * T * 1e21,
                         "v_rms (m/s)": vr, "음속 (m/s)": vs, "v_rms/음속": vr / vs,
                         "√(3/γ) (이론비)": float(np.sqrt(3 / g))})
    df = pd.DataFrame(rows)
    show("모듈 3: 온도 상승과 분자 운동 (병진 운동에너지 = 3/2·kT)", df, "{:.4f}")
    save_csv(df, "module3_kinetic.csv")
    t1, t2 = K(22.0), K(50.0)
    print(f"  22℃→50℃: 평균 운동에너지 +{(t2/t1-1)*100:.1f}%, 분자 평균 속력·음속 +{(np.sqrt(t2/t1)-1)*100:.1f}% "
          f"(에너지 ∝ T, 속력 ∝ √T)")
    print("  → v_rms/음속 = √(3/γ): 음속은 분자 평균 속력의 일정 비율(공기 약 1.46, CO2 약 1.53)이며,"
          " 둘 다 √T로 함께 변한다.")


# =====================================================================
# 모듈 4: 습도(수증기)
# =====================================================================
def p_sat(tc):
    """Magnus 형태 포화수증기압 [Pa], tc는 ℃ (문제에서 주어진 식)."""
    return 611.2 * np.exp(17.62 * tc / (243.12 + tc))


def humid_state(tc, rh):
    """습한 공기의 (v, M, γ, x_w). 건조 공기 몰분율 (1−x_w), 수증기 x_w."""
    xw = rh * p_sat(tc) / P_ATM
    M, _, g = mix(["AIR", "H2O"], [1 - xw, xw])
    return v_sound(M, g, K(tc)), M, g, xw


def module4():
    # 수증기(M 18)가 섞이면 평균 분자량이 작아져(28.97 → 감소) v ∝ √(γ/M)의 M 항 때문에 음속이 빨라진다.
    # 수증기는 γ가 더 작아(1.33 < 1.40) 음속을 아주 조금 낮추지만, 분자량 효과가 더 커서 순효과는 증가.
    tc0 = T_C
    rhs = np.linspace(0, 1, 101)
    vr = np.array([humid_state(tc0, r)[0] for r in rhs])
    Ts = np.linspace(10, 40, 121)

    fig, axs = plt.subplots(1, 3, figsize=(15, 4.8))
    ax = axs[0]
    ax.plot(rhs * 100, vr, color=C_BLUE)
    ax.set_title(f"(a) {tc0:.0f}℃에서 상대습도에 따른 음속", fontsize=9)
    ax.set_xlabel("상대습도 RH (%)"); ax.set_ylabel("음속 (m/s)")
    ax = axs[1]
    for rh, ls, mk, c in zip(RH_CASES, ("-", "--", "-."), ("o", "s", "^"), (C_BLUE, C_ORANGE, C_GREEN)):
        ax.plot(Ts, [humid_state(t, rh)[0] for t in Ts], ls=ls, color=c, marker=mk, markevery=30,
                ms=4, mfc="white", label=f"RH {rh:.0%}")
    ax.set_title("(b) 온도·습도별 음속", fontsize=9)
    ax.set_xlabel("온도 (℃)"); ax.set_ylabel("음속 (m/s)")
    ax.legend(loc="upper left")
    ax = axs[2]
    lo, hi = RH_FROM_TO
    dv = np.array([humid_state(t, hi)[0] - humid_state(t, lo)[0] for t in Ts])
    thr = 2 * FREQ_HZ * READ_ERR_CM / 100
    ax.plot(Ts, dv, color=C_BLUE, label=f"RH {lo:.0%}→{hi:.0%}에 의한 음속 증가")
    ax.axhline(thr, color=C_RED, ls="--", label=f"읽기 오차 {READ_ERR_CM} cm ≈ {thr:.1f} m/s")
    ax.set_ylim(0, thr * 1.25)
    ax.set_title("(c) 습도 변화 효과 vs 마디 간격 읽기 오차", fontsize=9)
    ax.set_xlabel("온도 (℃)"); ax.set_ylabel("Δ음속 (m/s)")
    ax.legend(loc="center left", bbox_to_anchor=(0.02, 0.62))
    fig.tight_layout(rect=[0, 0.05, 1, 1])
    caption(fig, "이론 계산(포화증기압: Magnus식, 1 atm). 수증기는 분자량 18로 공기(28.97)보다 가벼워 음속을 높인다.")
    save_fig(fig, "module4_humidity.png")

    # 표 1: 22℃ RH 스캔
    v_dry, M_dry, g_dry, _ = humid_state(tc0, 0.0)
    rows = []
    for rh in np.linspace(0, 1, 11):
        v, M, g, xw = humid_state(tc0, rh)
        rows.append({"RH (%)": rh * 100, "p_sat (Pa)": float(p_sat(tc0)), "x_w (%)": xw * 100,
                     "M (g/mol)": M * 1000, "γ": g, "음속 (m/s)": float(v),
                     "건조 대비 (m/s)": float(v - v_dry),
                     "분자량 효과 (%)": (np.sqrt(M_dry / M) - 1) * 100,
                     "γ 효과 (%)": (np.sqrt(g / g_dry) - 1) * 100})
    df = pd.DataFrame(rows)
    show(f"모듈 4: {tc0:.0f}℃, 상대습도별 음속", df, "{:.4f}")
    save_csv(df, "module4_rh_scan.csv")

    # 표 2: 습도 40→80% 판단
    thr = 2 * FREQ_HZ * READ_ERR_CM / 100
    rows = []
    for tc in (10, 22, 30, 40):
        v1, v2 = float(humid_state(tc, lo)[0]), float(humid_state(tc, hi)[0])
        dv = v2 - v1
        verdict = ("무시 가능" if dv < 0.5 * thr else
                   "경계(오차의 절반 이상)" if dv < thr else "무시 불가(보정 필요)")
        rows.append({"T (℃)": tc, f"v @RH{lo:.0%}": v1, f"v @RH{hi:.0%}": v2, "Δv (m/s)": dv,
                     "Δv (%)": dv / v1 * 100, "Δ마디 간격 (cm)": dv / (2 * FREQ_HZ) * 100,
                     "읽기 오차 환산 (m/s)": thr, "Δv / 읽기 오차": dv / thr, "판단": verdict})
    df = pd.DataFrame(rows)
    show(f"모듈 4: 습도 {lo:.0%}→{hi:.0%} 변화는 무시해도 되는가 (f = {FREQ_HZ:.0f} Hz, 읽기 오차 {READ_ERR_CM} cm)", df, "{:.3f}")
    save_csv(df, "module4_humidity_judgement.csv")
    print("  ※ 판단 기준(가정): Δv < 읽기 오차의 1/2 → 무시 가능, < 1배 → 경계, 그 이상 → 보정 필요.")


# =====================================================================
# 모듈 5: 기체 투과와 관 속 조성 유지
# =====================================================================
def module5():
    T = K(T_C)
    # 그레이엄 법칙: 속도비 ∝ 1/√M  →  rate_A/rate_B = √(M_B/M_A)
    pairs = [("CO2", "AIR"), ("CO2", "N2"), ("CO2", "O2"), ("He", "AIR")]
    rows = [{"비교": f"{a} 대 {'공기' if b == 'AIR' else b}",
             "M_A (g/mol)": COMP[a]["M"] * 1000, "M_B (g/mol)": COMP[b]["M"] * 1000,
             "속도비 A/B = √(M_B/M_A)": float(np.sqrt(COMP[b]["M"] / COMP[a]["M"]))}
            for a, b in pairs]
    gdf = pd.DataFrame(rows)
    show("모듈 5: 그레이엄 법칙 유출·투과 속도비 (같은 조건)", gdf, "{:.3f}")
    save_csv(gdf, "module5_graham.csv")
    print("  ※ 그레이엄 법칙은 작은 구멍 유출·좁은 기공 확산(노드센)에 대한 법칙이다. 고분자막의 용해-확산 투과나")
    print("    스펀지·거즈의 큰 틈 흐름에는 그대로 맞지 않으며(CO2는 용해도가 커서 더 빠를 수 있다), 아래 k는 임의 가정값이다.")

    t = np.linspace(0, 5, 301)
    fig, axs = plt.subplots(1, 3, figsize=(15, 4.8))
    ax = axs[0]
    vals = gdf["속도비 A/B = √(M_B/M_A)"].values
    bars = ax.barh(range(len(vals)), vals, color="white", edgecolor=C_BLUE, lw=0.9)
    for b_, h in zip(bars, ("//", "..", "xx", "\\\\")):   # 막대마다 무늬로도 구분
        b_.set_hatch(h)
    ax.axvline(1, color=C_GRAY, lw=0.7, ls="--")
    ax.set_yticks(range(len(vals)))
    ax.set_yticklabels(["CO$_2$ 대 공기", "CO$_2$ 대 N$_2$", "CO$_2$ 대 O$_2$", "He 대 공기"])
    ax.invert_yaxis()
    for i, v in enumerate(vals):
        ax.text(max(v, 1.0) + 0.06, i, f"{v:.2f}", va="center", fontsize=8)
    ax.set_xlim(0, 3.3)
    ax.set_xlabel("속도비 (그레이엄 법칙, 점선 = 1)")
    ax.set_title("(a) 유출·투과 속도비 = √(M$_B$/M$_A$)", fontsize=9)
    ax.grid(axis="y", visible=False)

    styles = [("-", "o", C_BLUE), ("--", "s", C_RED)]
    ax1, ax2 = axs[1], axs[2]
    rows = []
    v0 = float(v_binary("AIR", "CO2", X0_CO2, T))
    for (name, k), (ls, mk, c) in zip(K_ASSUMED.items(), styles):
        x = X0_CO2 * np.exp(-k * t)
        v = v_binary("AIR", "CO2", x, T)
        ax1.plot(t, x * 100, ls=ls, color=c, marker=mk, markevery=50, mfc="white", ms=4,
                 label=f"{name}, k={k:g}/min")
        ax2.plot(t, v, ls=ls, color=c, marker=mk, markevery=50, mfc="white", ms=4, label=name)
        row = {"소재 (가정)": name, "k (1/min, 가정)": k, "x0 (%)": X0_CO2 * 100, "v(0) (m/s)": v0}
        for tm in MEAS_MIN:
            xt = X0_CO2 * np.exp(-k * tm)
            vt = float(v_binary("AIR", "CO2", xt, T))
            row[f"x({tm:g}분) (%)"] = xt * 100
            row[f"v({tm:g}분) (m/s)"] = vt
            row[f"Δv 0→{tm:g}분 (m/s)"] = vt - v0
        rows.append(row)
    for ax in (ax1, ax2):
        for tm in MEAS_MIN:
            ax.axvline(tm, color="#999999", lw=0.6, ls=":")
        ax.set_xlabel("시간 t (분)")
    ax1.set_ylabel("관 속 CO$_2$ 비율 (%)")
    ax1.set_title("(b) x(t) = x$_0$·exp(-k·t)", fontsize=9)
    ax1.set_ylim(0, 105)
    ax1.legend(loc="lower left", fontsize=7.5)
    ax2.set_ylabel("이론 음속 (m/s)")
    ax2.set_title("(c) CO$_2$가 빠져나가면 음속이 빨라진다", fontsize=9)
    ax2.legend(loc="upper left", fontsize=7.5)
    fig.tight_layout(rect=[0, 0.07, 1, 1])
    caption(fig, "※ 소재의 투과 계수 k는 임의로 가정한 값이며 측정값이 아니다. 점선은 측정 시간 1분·3분. "
                 f"시작 CO$_2$ {X0_CO2:.0%}도 가정이다. (a)는 그레이엄 법칙의 이론 비.")
    save_fig(fig, "module5_permeation.png")

    df = pd.DataFrame(rows)
    show("모듈 5: 측정 시간 동안 음속 변화 (k는 임의 가정값)", df, "{:.2f}")
    save_csv(df, "module5_kinetics.csv")
    thr = 2 * FREQ_HZ * READ_ERR_CM / 100
    print(f"  참고: 읽기 오차 {READ_ERR_CM} cm ≈ {thr:.1f} m/s. Δv가 이보다 크면 측정 중 조성 변화를 무시할 수 없다.")


# =====================================================================
# 모듈 6 (부가): 관 끝 경계 조건과 열린 공간
# =====================================================================
def module6():
    L, r, v, f0 = TUBE_L_CM / 100, TUBE_R_CM / 100, TUBE_V, FREQ_HZ
    Leff = L + 0.6 * r
    n = np.arange(1, 7)
    f_closed = n * v / (2 * L)
    f_open = (2 * n - 1) * v / (4 * Leff)
    df = pd.DataFrame({"n": n, "닫힌 끝 f_n=nv/(2L) (Hz)": f_closed,
                       "열린 끝 f_n=(2n−1)v/(4(L+0.6r)) (Hz)": f_open,
                       "닫힌 끝 마디 간격 (cm)": v / (2 * f_closed) * 100,
                       "열린 끝 마디 간격 (cm)": v / (2 * f_open) * 100})
    show(f"모듈 6: 공명 주파수 (L={TUBE_L_CM:g} cm, r={TUBE_R_CM:g} cm, v={v:g} m/s)", df, "{:.2f}")
    save_csv(df, "module6_resonance.csv")

    nn = np.arange(1, 41)
    fc_all, fo_all = nn * v / (2 * L), (2 * nn - 1) * v / (4 * Leff)
    ic, io = int(np.argmin(abs(fc_all - f0))), int(np.argmin(abs(fo_all - f0)))
    print(f"  {f0:.0f} Hz에 가장 가까운 공명: 닫힌 끝 n={nn[ic]} ({fc_all[ic]:.1f} Hz, 차이 {fc_all[ic]-f0:+.1f} Hz), "
          f"열린 끝 n={nn[io]} ({fo_all[io]:.1f} Hz, 차이 {fo_all[io]-f0:+.1f} Hz)")
    sp = v / (2 * f0) * 100
    # 마디 간격 = λ/2: 닫힌 끝 L/n, 열린 끝 2(L+0.6r)/(2n−1) — 둘 다 v/(2f)와 같은지 확인
    same = np.allclose(L / n * 100, v / (2 * f_closed) * 100) and \
        np.allclose(2 * Leff / (2 * n - 1) * 100, v / (2 * f_open) * 100)
    print(f"  마디 간격 v/(2f) = {sp:.2f} cm @ {f0:.0f} Hz. 두 경계 조건 모두 공명 모드에서 λ/2 = v/(2f)와 같음: {same}")
    err = (L / Leff - 1) * 100
    print(f"  개구단 보정 0.6r = {0.6*TUBE_R_CM:.2f} cm을 무시하고 v=4Lf/(2n−1)로 계산하면 음속 오차 {err:+.2f}% "
          f"(= {v*err/100:+.1f} m/s, 모든 n에서 동일)")
    save_csv(pd.DataFrame([dict(항목="개구단 보정 무시 시 음속 오차(%)", 값=err),
                           dict(항목=f"{f0:.0f}Hz 최근접 닫힌 끝 n", 값=nn[ic]),
                           dict(항목="  주파수 차이(Hz)", 값=fc_all[ic] - f0),
                           dict(항목=f"{f0:.0f}Hz 최근접 열린 끝 n", 값=nn[io]),
                           dict(항목="  주파수 차이(Hz)", 값=fo_all[io] - f0),
                           dict(항목="마디 간격 v/(2f) (cm)", 값=sp)]), "module6_summary.csv")

    # 그림: 가장 가까운 공명 모드의 변위 진폭, 그리고 자유 공간 1/r 감쇠
    fig, axs = plt.subplots(1, 2, figsize=(11, 4.6))
    ax = axs[0]
    xc = np.linspace(0, L, 400)
    xo = np.linspace(0, Leff, 400)
    nc, no = nn[ic], nn[io]
    ax.plot(xc * 100, abs(np.sin(nc * np.pi * xc / L)), color=C_BLUE, ls="-",
            label=f"닫힌 끝 n={nc} ({fc_all[ic]:.0f} Hz)")
    ax.plot(xo * 100, abs(np.sin((2 * no - 1) * np.pi * xo / (2 * Leff))), color=C_RED, ls="--",
            label=f"열린 끝 n={no} ({fo_all[io]:.0f} Hz)")
    ax.axvline(TUBE_L_CM, color=C_GRAY, lw=0.7, ls=":")
    ax.text(TUBE_L_CM - 0.3, 1.08, "관 끝 (x=L)", ha="right", fontsize=7.5, color=C_GRAY)
    ax.set_xlim(0, Leff * 100 + 1)
    ax.set_ylim(0, 1.35)
    ax.set_xlabel("관 안의 위치 x (cm)")
    ax.set_ylabel("변위 진폭 (상대값)")
    ax.set_title("(a) 관 안 정상파: 진폭이 0인 마디가 일정 간격으로 생긴다", fontsize=9)
    ax.legend(loc="upper left", ncol=1)
    ax = axs[1]
    rr = np.logspace(np.log10(FREE_R0_CM), 2, 200)
    ax.plot(rr, FREE_R0_CM / rr, color=C_GREEN, label="자유 공간 점음원: 진폭 ∝ 1/r")
    ax.axhline(1.0, color=C_BLUE, ls="--", label="관 안 정상파: 진폭 봉우리 높이 유지(손실 무시)")
    ax.set_xscale("log")
    ax.set_xlabel("음원에서의 거리 r (cm, 로그 축)")
    ax.set_ylabel(f"진폭 (r = {FREE_R0_CM:g} cm에서 1로 규격화)")
    ax.set_ylim(0, 1.35)
    ax.set_title("(b) 관 없는 자유 공간: 거리에 따라 1/r로 감쇠", fontsize=9)
    ax.legend(loc="upper right")
    fig.tight_layout(rect=[0, 0.06, 1, 1])
    caption(fig, "※ 이론 계산이며 실험으로 확인한 것이 아니다. (a) 닫힌 끝은 양 끝이 막힌 관, 열린 끝은 한쪽만 열린 관(개구단 보정 0.6r). "
                 "(b)의 기준 거리와 진폭은 규격화 값이다.")
    save_fig(fig, "module6_boundary.png")


# =====================================================================
def main():
    setup_style()
    OUT.mkdir(exist_ok=True)
    for fn in (module0, module1, module2, module3, module4, module5, module6):
        print("\n" + "#" * 70)
        fn()
    print(f"\n완료: {OUT} 에 PNG·CSV 저장")


if __name__ == "__main__":
    main()
