"""「똥 작전」 사운드: 오리지널 쿨재즈 스코어(비브라폰·재즈 피치카토 베이스·브러시·스냅) + 재질별 폴리 + 룸톤 → out/mix.wav
실행: $LIB/.venv/bin/python films/sloth-mission/mix.py (events.json 필요: node core/render/events.mjs)
120 BPM, 1박 0.5s. 21.0~21.5 완전 침묵(룸톤 포함). 27.0 반전에 한 키 위(F→G)로."""
import sys, os, json
import numpy as np, soundfile as sf
LIB = os.environ.get('LIB', os.path.expanduser('~/lemo-opuscar'))
sys.path.insert(0, LIB)
from core.audio import sampler as S
from core.audio.sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, brown, click, clack, whoosh, creak, thump, step, ding, pop, add, compress, limit

D = os.path.dirname(os.path.abspath(__file__))
E = json.load(open(os.path.join(D, 'events.json')))
DUR = 30.0; N = int(round(DUR * SR)); B = 0.5
S.seed(7); rng = np.random.default_rng(7)
music = np.zeros((N, 2), np.float32); fol = np.zeros((N, 2), np.float32); amb = np.zeros((N, 2), np.float32)

def sw(t):  # 스윙: 뒷박 8분음표를 60% 지점으로
    beat = np.floor(t / B + 1e-9); fr = t / B - beat
    return (beat + (0.6 if abs(fr - .5) < 1e-6 else fr)) * B

NOTE = {'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}
Q = {'maj7': [0, 4, 7, 11, 14], 'm7': [0, 3, 7, 10, 14], '7': [0, 4, 10, 14, 21], 'm7b5': [0, 3, 6, 10], 'dim7': [0, 3, 6, 9], '69': [0, 4, 9, 14, 19], 'maj9': [0, 4, 11, 14, 19]}
def chord(name, q, base=55):
    r = NOTE[name]; m = base + ((r - base) % 12)
    return [m + i for i in Q[q]]
def root(name, lo=36): return lo + ((NOTE[name] - lo) % 12)

def vib(t, notes, dur=1.6, vel=.5, hard=False, pan=-.2, gain=1.0):
    for i, m in enumerate(notes):
        x = S.note('vibraphone_hard' if hard else 'vibraphone', m, dur, vel=vel)
        tt = np.arange(len(x)) / SR
        x = x * (1 - .25 * (.5 + .5 * np.sin(2 * np.pi * 5.2 * tt + i)))
        add(music, x, t + i * .012, gain * .55, pan + (i - 2) * .08)
def bass(t, m, dur=.45, vel=.7, gain=1.0):
    add(music, S.note('jazz_bass', m, dur, vel=vel), t, gain * 1.1, .05)
def gliss(t0, ms, step_=.05, vel=.45, hard=False):
    for i, m in enumerate(ms): vib(t0 + i * step_, [m], dur=1.0, vel=vel, hard=hard, pan=-.4 + .8 * i / max(1, len(ms) - 1), gain=.7)
def brush(t, v=.5, d=.22):
    x = bp(noise(d), 2500, 9000) * env_exp(d, d / 3) * np.sin(np.pi * t_(d) / d) ** .3
    add(music, x * v * .5, t, 1, .3)
def tap(t, v=.4):
    d = .06; add(music, hp(noise(d), 4000) * env_exp(d, .008) * v, t, 1, .3)
def snap(t, v=.6):
    d = .08; x = bp(noise(d), 1800, 6000) * env_exp(d, .01) + np.sin(2 * np.pi * 2300 * t_(d)) * env_exp(d, .006) * .4
    add(music, x * v * .6, t, 1, .45)

def walk(t0, t1, chords):  # chords: [(t, rootname)] 워킹 베이스 (4분음표)
    seq = sorted(chords)
    t = t0
    while t < t1 - 1e-6:
        r = [c for c in seq if c[0] <= t + 1e-6][-1][1]
        beat = int(round((t - t0) / B)) % 4
        m = root(r) + [0, 4, 7, 5][beat] if beat else root(r)
        # 다음 코드로 반음 접근
        nxt = [c for c in seq if c[0] > t + 1e-6]
        if nxt and abs(nxt[0][0] - (t + B)) < 1e-6: m = root(nxt[0][1]) - 1
        bass(t, m, .46, .62 + .1 * (beat == 0))
        t += B

# ---------------- 스코어 ----------------
# 0–5 훅: 비브라폰 코드 + 브러시
for t, c in [(0.0, ('F', 'maj7')), (2.0, ('D', 'm7')), (4.0, ('G', 'm7'))]: vib(t, chord(*c), 2.2, .45)
vib(3.0, chord('G', 'm7', 60)[:3], .8, .35, pan=.3)
# 5–10 브리핑: 워킹 베이스 합류
walk(5.0, 10.0, [(5.0, 'G'), (6.0, 'C'), (7.0, 'F'), (8.0, 'D'), (9.0, 'G')])
for t, c in [(5.0, ('G', 'm7')), (6.0, ('C', '7')), (7.0, ('F', 'maj7')), (8.0, ('D', '7')), (9.0, ('G', 'm7'))]: vib(sw(t + .5), chord(*c), .9, .42)
# 10–15 장비·유언
walk(10.0, 15.0, [(10.0, 'Bb'), (11.0, 'B'), (12.0, 'A'), (13.0, 'D'), (14.0, 'G'), (14.5, 'C')])
for t, c in [(10.0, ('Bb', 'maj7')), (11.0, ('B', 'dim7')), (12.0, ('A', 'm7')), (13.0, ('D', '7')), (14.0, ('G', 'm7'))]: vib(sw(t + .5), chord(*c), .9, .42)
vib(10.95, [84, 88], .6, .5, hard=True, pan=.4)  # 딸깍에 맞춘 높은 음
# 15–20 하강: 점프컷마다 코드가 반음씩 내려간다, 트레몰로
for i, (t, c) in enumerate([(15.0, ('E', 'maj7')), (16.0, ('Eb', 'maj7')), (17.0, ('D', 'm7b5')), (18.0, ('Db', 'maj7')), (19.0, ('C', 'm7'))]):
    vib(t, chord(*c), 1.0, .5, pan=-.1)
    for k in range(4): bass(t + k * B * .5 if k else t, root(c[0]) - (k % 2) * 12 if k else root(c[0]), .25, .55)
gliss(20.0, list(range(84, 59, -2)), .055, .42)
bass(20.75, 29, 1.2, .9)
# 21.0–21.5 침묵. 21.5~ 살금살금 스타카토 베이스
for k, m in enumerate([41, 44, 46, 47, 48]): bass(21.5 + k * B * .5 + (0.0 if k < 3 else .25), m, .18, .55)
vib(22.5, [77, 84], .8, .45, hard=True)  # 뽕
vib(23.5, chord('G', '7', 60), 1.4, .6, hard=True)  # 임무 완수
bass(24.0, 31, .9, .95); vib(24.0, [59, 65], 1.2, .55, hard=True)  # 맹수
gliss(24.3, [76, 74, 72, 70, 68, 66, 64], .14, .35)  # 하품
for k in range(4): bass(25.5 + k * .25, [43, 41, 40, 38][k], .2, .5)
# 26.5–30 하프타임 → 27.0 한 키 위
bass(26.5, root('D'), .5, .6)
vib(27.0, chord('G', 'maj9', 60), 2.4, .65, hard=True)
gliss(27.0, list(range(67, 92, 3)), .04, .4, hard=True)
bass(27.0, root('G'), 1.0, .8)
for t, c, r in [(28.0, ('E', 'm7'), 'E'), (28.5, ('A', '7'), 'A'), (29.0, ('D', '7'), 'D')]: vib(t, chord(*c), .7, .45); bass(t, root(r), .45, .65)
vib(29.5, chord('G', '69', 60), 1.6, .55); bass(29.5, root('G'), .6, .7)
# 리듬: 브러시 스윕(2·4박), 스냅
for k in range(int(30 / B)):
    t = k * B
    if 21.0 <= t < 21.5 or t >= 29.8: continue
    if t < 5.0: brush(t, .25 if k % 2 else .15)
    elif t < 26.5:
        brush(t, .5 if k % 2 else .3); tap(sw(t + .25), .25)
        if 5.0 <= t < 15.0 and k % 2: snap(t, .5)
    else:
        if k % 2: brush(t, .35)

# ---------------- 폴리 ----------------
def stamp():
    d = .3; return norm(np.sin(2 * np.pi * 140 * (1 - .4 * t_(d)) * t_(d)) * env_exp(d, .035) + lp(noise(d), 1800) * env_exp(d, .012) * .9)
def paper(d=.3): return norm(bp(noise(d), 1800, 8000)) * np.sin(np.pi * t_(d) / d) ** 2
def chalk(d): x = bp(noise(d), 2500, 7000) * (.5 + .5 * np.abs(np.sin(2 * np.pi * 9 * t_(d)))); return norm(x) * .6
def whistle(up=True, d=.4):
    f = np.linspace(600, 1500, len(t_(d))) if up else np.linspace(1500, 500, len(t_(d)))
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.sin(np.pi * t_(d) / d) ** .6
def plop():
    d = .25; f = 900 * np.exp(-t_(d) * 14) + 180
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .06))
def yawn():
    d = 1.4; f = np.linspace(330, 150, len(t_(d)))
    x = lp(noise(d), 900) * .5 + np.sin(2 * np.pi * np.cumsum(f) / SR) * .4 + np.sin(2 * np.pi * np.cumsum(f * 2) / SR) * .15
    return norm(x) * np.sin(np.pi * t_(d) / d) ** .8
def snore():
    d = .9; return norm(lp(noise(d), 500) * (.5 + .5 * np.sin(2 * np.pi * 3 * t_(d)))) * np.sin(np.pi * t_(d) / d)
def leaf(): d = .45; return norm(bp(noise(d), 1200, 6000) * (.6 + .4 * np.abs(np.sin(2 * np.pi * 23 * t_(d))))) * np.sin(np.pi * t_(d) / d)
def iris(): d = .3; return norm(bp(noise(d), 3000, 9000)) * np.sin(np.pi * t_(d) / d) ** 2 * .6

FX = {
    'pop': lambda e: (pop(.6), .35), 'creak': lambda e: (creak(.5), .35), 'paper': lambda e: (paper(.35), .45),
    'stamp': lambda e: (stamp(), .7), 'iris': lambda e: (iris(), .5), 'swish': lambda e: (paper(.25), .35),
    'chalk': lambda e: (chalk(e.get('d', .5)), .35), 'click': lambda e: (norm(clack(1.4, 1)[:int(.12 * SR)]), .7),
    'wipe': lambda e: (whoosh(.45, 1), .4), 'jump': lambda e: (norm(click(1.6, 1)), .45), 'snore': lambda e: (snore(), .35),
    'fall': lambda e: (whistle(False, .75), .45), 'thump': lambda e: (thump(1, 60), .8), 'leaf': lambda e: (leaf(), .5),
    'plop': lambda e: (plop(), .8), 'cat': lambda e: (thump(.9, 80), .7), 'yawn': lambda e: (yawn(), .7),
    'whistle': lambda e: (whistle(True, .45), .45), 'tap': lambda e: (norm(click(1.2, .8)), .4), 'ding': lambda e: (ding(.6), .3),
}
for e in E['ev']:
    if e['type'] == 'steps':
        for k in range(4): add(fol, step(.6), e['t'] + k * .25, .4, .5)
    elif e['type'] in FX:
        x, gn = FX[e['type']](e); add(fol, x, e['t'], gn, 0)

# ---------------- 앰비언스: 정글 룸톤 + 시계 틱, 밤에는 벌레 ----------------
room = lp(brown(DUR), 400); room = norm(room) * .05
amb[:, 0] += room[:N]; amb[:, 1] += room[:N]
for k in range(int(26.5 / 1.0)):
    if not (21.0 <= k < 21.5): add(amb, norm(click(2.2, .3)) * .04, k * 1.0, 1, -.3)
d = 1.0; crick = bp(noise(d), 4200, 5200) * (np.sin(2 * np.pi * 30 * t_(d)) > .3) * .05
add(amb, crick, 17.0, 1, .4)

# 21.0~21.5 완전 침묵
a, b = int(21.0 * SR), int(21.5 * SR)
for buf in (music, fol, amb): buf[a:b] = 0

# ---------------- 내레이션 (vo.py → voice/vo.wav, Adam) : 압축 후 음악을 그 아래로 덕킹 ----------------
vo, vsr = sf.read(os.path.join(D, 'voice', 'vo.wav'), dtype='float32')
assert vsr == SR, vsr
vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]
vo = compress(vo.astype(np.float64), .2, 3.0).astype(np.float32)
vo = vo / max(1e-6, np.sqrt(np.mean(vo[np.abs(vo) > .02] ** 2))) * .16   # 말하는 구간 RMS 기준
from scipy.ndimage import maximum_filter1d, uniform_filter1d
act = (maximum_filter1d(np.abs(vo), int(.25 * SR)) > .01).astype(np.float32)
duck = 1 - .62 * np.clip(uniform_filter1d(act, int(.12 * SR)), 0, 1)       # 약 −8.5dB
music *= duck[:, None]; amb *= (1 - .3 * (1 - duck))[:, None]

mix = music * .9 + fol * 1.0 + amb + np.stack([vo, vo], 1)
mix = limit(mix * .8, .92)
os.makedirs(os.path.join(D, 'out'), exist_ok=True)
sf.write(os.path.join(D, 'out', 'mix.wav'), mix, SR)
print('mix ok', mix.shape, float(np.abs(mix).max()))
