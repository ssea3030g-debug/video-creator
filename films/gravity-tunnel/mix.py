"""mix.py — original score + instrument foley for "42분 터널" → mix.wav (48 kHz stereo).
Reads events.json (node core/render/events.mjs <project>): the same timeline as the picture.
The signal tone is computed from the same motion as the trace: its pitch follows the ball's speed.
All music is original, synthesised with numpy (plucked synth, sine bells, soft bass with 2nd/3rd harmonics, sine pad)."""
import sys, os, json, numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB') or os.path.expanduser('~/lemo-opuscar')
sys.path.insert(0, os.path.join(LIB, 'core/audio'))
import sfx
from sfx import SR, t_, env_exp, bp, lp, hp, noise

E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; EV = E['ev']
N = int(DUR * SR) + SR // 2
mus = np.zeros((N, 2)); fx = np.zeros((N, 2)); bed = np.zeros((N, 2))
MU = next(e for e in EV if e['type'] == 'mus'); PH = next(e for e in EV if e['type'] == 'phys')
BEAT = 60 / MU['bpm']

def put(bus, x, at, g=1.0, pan=0.0):
    s = int(round(at * SR)); x = np.asarray(x, float) * g
    if s >= N or s + len(x) <= 0: return
    if s < 0: x = x[-s:]; s = 0
    x = x[:N - s]; l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    bus[s:s + len(x), 0] += x * l * 1.414; bus[s:s + len(x), 1] += x * r * 1.414
def mf(m): return 440 * 2 ** ((m - 69) / 12)

# —— instruments ——
def pluck(m, d=.45, bright=.5, g=.12):
    """plucked synth: a few harmonics with faster decay on the upper ones; 'bright' follows the signal"""
    tt = t_(d); f = mf(m); x = np.zeros_like(tt)
    for k in range(1, 7):
        x += (bright ** (k - 1)) / k * np.sin(2 * np.pi * f * k * tt) * np.exp(-tt * (6 + 5 * k))
    return x * np.minimum(1, tt / .003) * g
def bell(m, d=2.2, g=.12):
    tt = t_(d); f = mf(m)
    x = sum(a * np.sin(2 * np.pi * f * r * tt) * np.exp(-tt / (d * dc)) for r, a, dc in ((1, 1, .5), (2.76, .35, .18), (5.4, .18, .08), (2, .25, .3)))
    return x * np.minimum(1, tt / .002) * g
def bass(m, d, g=.2):
    tt = t_(d); f = mf(m)
    x = np.sin(2 * np.pi * f * tt) + .35 * np.sin(4 * np.pi * f * tt) + .18 * np.sin(6 * np.pi * f * tt)
    return x * np.minimum(1, tt / .01) * np.clip((d - tt) / .08, 0, 1) * np.exp(-tt * .9) * g
def pad(ms, d, g=.05):
    tt = t_(d); x = sum(np.sin(2 * np.pi * mf(m) * tt * (1 + .0015 * np.sin(2 * np.pi * .3 * tt + i))) for i, m in enumerate(ms))
    return x * np.minimum(1, tt / 1.2) * np.clip((d - tt) / .6, 0, 1) * g

# —— score (A minor, 120 bpm, bar = 2 s) ——
STOP, RUN, HUSH, A1, A2, VER, OFF = MU['stop'], MU['run'], MU['hush0'], MU['arrive1'], MU['arrive2'], MU['verdict'], MU['off']
ARP = [57, 60, 64, 67, 69, 67, 64, 60]                 # Am(add) figure
CH = [(45, [57, 60, 64]), (41, [57, 60, 65]), (43, [55, 59, 62]), (40, [56, 59, 64])]   # Am F G E
def chord_at(t): return CH[int(t // (4 * BEAT)) % 4]
def bright_at(t, t0, t1): return .25 + .55 * abs(np.sin(np.pi * np.clip((t - t0) / (t1 - t0), 0, 1)))

# intro bells
put(mus, bell(81, 2.5, .08), 0.9, pan=-.3); put(mus, bell(76, 2.5, .07), 1.6, pan=.3)
# section 1: fall 3–11 eighth-note plucks, brightness follows speed
k = 0; t = 3.0
while t < A1 - 1e-6:
    root, tri = chord_at(t - 3.0); m = tri[k % 3] + (12 if k % 4 == 3 else 0)
    put(mus, pluck(m, .5, bright_at(t, 3.0, A1), .11), t, pan=(-.35 if k % 2 else .35))
    if k % 8 == 0: put(mus, bass(root, 4 * BEAT * .95), t)
    k += 1; t += BEAT / 2
# arrival 1: bell + resolving bass, then quarter-note plucks till STOP
put(mus, bell(69, 3.0, .16), A1); put(mus, bell(76, 3.0, .08), A1 + .02, pan=.2); put(mus, bass(45, 3.2, .22), A1)
t = A1 + BEAT * 2; k = 0
while t < STOP - 1e-6:
    put(mus, pluck([64, 60, 57, 52][k % 4], .6, .3, .08), t, pan=.2 * (-1) ** k); k += 1; t += BEAT
# STOP: music cut dead (nothing until RUN)
# section 2: two voices (CH1 / CH2) 16–21.4, then hush
t = RUN; k = 0
while t < HUSH - 1e-6:
    root, tri = chord_at(t - RUN); b = bright_at(t, RUN, A2)
    put(mus, pluck(tri[k % 3] + 12, .45, b, .09), t, pan=-.45)
    put(mus, pluck(tri[(k + 1) % 3], .5, b * .8, .08), t + BEAT / 4, pan=.45)
    if k % 8 == 0: put(mus, bass(root, 4 * BEAT * .95), t)
    k += 1; t += BEAT / 2
# arrival 2: the biggest sound after near-silence
for m, g, p in ((45, .25, 0), (57, .14, -.3), (64, .12, .3), (69, .16, 0), (76, .1, -.2), (81, .07, .2)):
    put(mus, bell(m, 4.0, g) if m > 50 else bass(m, 3.8, g), A2, pan=p)
# verdict: pad + bells, ending before power-off
put(mus, pad([57, 64, 69, 72], OFF - VER + .3, .045), VER)
for i, m in enumerate([76, 81, 84]): put(mus, bell(m, 2.8, .07), VER + .7 + i * BEAT, pan=(i - 1) * .4)
s = int(OFF * SR); mus[s:] *= np.linspace(1, 0, N - s)[:, None] ** 2

# —— foley ——
def relay(): d = .09; x = bp(noise(d), 1500, 7000) * env_exp(d, .008); return x + np.sin(2 * np.pi * 160 * t_(d)) * env_exp(d, .015) * .5
def tick(): d = .025; return hp(noise(d), 3000) * env_exp(d, .004)
def blip(): d = .09; return np.sin(2 * np.pi * 1760 * t_(d)) * env_exp(d, .025)
def sweep(d, f0, f1):
    n = len(t_(d)); f = np.geomspace(f0, f1, n); x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return x * np.minimum(1, t_(d) / .02) * np.clip((d - t_(d)) / .05, 0, 1)
def zap(d, f0, f1): return sweep(d, f0, f1) * env_exp(d, d / 2.5)
def signal(t0, t1, amp):
    """quiet tone whose pitch follows the ball's speed — same phase as the picture"""
    d = t1 - t0; tt = t_(d); ph = np.pi * tt / d; v = amp * np.abs(np.sin(ph))
    f = 180 + 520 * v; x = np.sin(2 * np.pi * np.cumsum(f) / SR) + .25 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return x * np.minimum(1, tt / .05) * np.clip((d - tt) / .05, 0, 1) * (.35 + .65 * v)
def fallnoise(t0, t1, amp):
    d = t1 - t0; tt = t_(d); v = amp * np.abs(np.sin(np.pi * tt / d))
    x = noise(d); lo = lp(x, 600) * (1 - v) + bp(x, 600, 3000) * v
    return lo * v * np.minimum(1, tt / .2)

for e in EV:
    ty, t = e['type'], e['t']
    if ty == 'relay': put(fx, relay(), t, .5)
    elif ty == 'zap_on': put(fx, zap(.35, 120, 900), t, .12)
    elif ty == 'zap_off': put(fx, zap(.5, 1600, 60), t, .18)
    elif ty == 'tick': put(fx, tick(), t, .16, pan=np.sin(t * 7) * .4)
    elif ty == 'draw': put(fx, sweep(e['d'], 300, 1200) * .5 * np.exp(-t_(e['d']) * 1.5), t, .07)
    elif ty == 'spawn': put(fx, blip(), t, .12); put(fx, bell(88, .6, 1), t, .05)
    elif ty == 'fall':
        put(fx, signal(t, e['t1'], e['amp']), t, .045, pan=(-.35 if e['ch'] == 1 else .35))
        put(fx, fallnoise(t, e['t1'], e['amp']), t, .07, pan=(-.2 if e['ch'] == 1 else .2))
    elif ty == 'center': put(fx, bell(88, 1.2, 1), t, .05)
    elif ty == 'arrive': put(fx, sfx.thump(1, 60), t, .35 if e.get('big') else .25)
    elif ty == 'blip': put(fx, blip(), t, .14)

# hum bed: mains-like hum, quiet, always on (heard alone during STOP)
tt = t_(N / SR); hum = sum(a * np.sin(2 * np.pi * f * tt) for f, a in ((60, 1), (120, .5), (180, .3), (240, .12)))
hum = hum * .012 + lp(noise(N / SR), 3000) * .0025
hum[:int(.05 * SR)] *= np.linspace(0, 1, int(.05 * SR)); s = int((OFF + .3) * SR); hum[s:] *= np.linspace(1, 0, N - s) ** 3
bed[:, 0] += hum; bed[:, 1] += hum

out = mus + fx + bed
out = np.stack([sfx.limit(out[:, i] * 0.9) for i in range(2)], 1)
sf.write(os.path.join(HERE, 'mix.wav'), out.astype(np.float32), SR, subtype='FLOAT')
print('mix.wav', round(len(out) / SR, 2), 's, peak', round(float(np.abs(out).max()), 3))
