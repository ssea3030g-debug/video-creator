"""mix.py — original chiptune score + synthesised chip foley for "Dry Gulch" → mix.wav (48 kHz stereo, float)
Reads events.json (node core/render/events.mjs <project>). Music sections come from the 'mus' events, so picture and score share one timeline.
Voices: pulse waves (12.5/25/50 %), a 4-bit triangle bass, LFSR-style noise drums, SNES-style echo. All melodies original."""
import sys, os, json, numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ.get('LIB') or os.path.abspath(os.path.join(HERE, '../..'))
sys.path.insert(0, os.path.join(LIB, 'core/audio'))
import sfx
from sfx import SR, t_, env_exp, bp, lp, hp, noise, norm

E = json.load(open(os.path.join(HERE, 'events.json'))); DUR = E['dur']; EV = E['ev']
N = int(DUR * SR) + SR; rng = np.random.default_rng(7)
mus = np.zeros((N, 2)); fx = np.zeros((N, 2))

def put(bus, x, at, g=1.0, pan=0.0):
    s = int(round(at * SR)); x = np.asarray(x, float) * g
    if s >= N or s + len(x) <= 0: return
    if s < 0: x = x[-s:]; s = 0
    x = x[:N - s]; l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    bus[s:s + len(x), 0] += x * l * 1.414; bus[s:s + len(x), 1] += x * r * 1.414

# —— chip sources ——
def mf(m): return 440 * 2 ** ((m - 69) / 12)
NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
def m(n): return 12 * (int(n[-1]) + 1) + NOTE[n[:-1]]
def sq(f, d, duty=.5):
    n = int(round(d * SR)); ph = np.cumsum(np.full(n, f) if np.ndim(f) == 0 else f) / SR; return ((ph % 1) < duty).astype(float) * 2 - 1
def tri(f, d):
    n = int(round(d * SR)); ph = np.cumsum(np.full(n, f) if np.ndim(f) == 0 else f) / SR; x = 2 * np.abs(2 * (ph % 1) - 1) - 1
    return np.round(x * 7) / 7
def crush(x, bits=8, sr=48000):
    if sr < SR: st = int(SR / sr); x = np.repeat(x[::st], st)[:len(x)]
    q = 2 ** (bits - 1); return np.round(x * q) / q
def adsr(d, a=.004, dec=.08, sus=.6, r=.06):
    tt = t_(d); e = np.minimum(1, tt / max(a, 1e-4)); e = np.where(tt > a, sus + (1 - sus) * np.exp(-(tt - a) / max(dec, 1e-4)), e)
    return e * np.clip((d - tt) / max(r, 1e-4), 0, 1)
def vib(f, d, depth=.006, rate=5.5, delay=.15):
    tt = t_(d); return f * (1 + depth * np.sin(2 * np.pi * rate * tt) * np.clip((tt - delay) / .2, 0, 1))
def stereo_echo(x, taps=((.18, .38, -.5), (.27, .26, .5), (.37, .16, -.3)), fb=.0):
    out = np.zeros((len(x) + int((max(tp[0] for tp in taps) + .05) * SR), 2)); out[:len(x)] += x[:, None]
    for dt, g, pan in taps:
        s = int(dt * SR); y = lp(x, 3500) * g; l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        out[s:s + len(y), 0] += y * l * 1.4; out[s:s + len(y), 1] += y * r * 1.4
    return out
def put2(bus, y, at, g=1.0):
    s = int(round(at * SR)); y = y[:max(0, N - s)] * g; bus[s:s + len(y)] += y
def kick(): d = .12; return np.sin(2 * np.pi * np.cumsum(np.linspace(140, 45, int(d * SR))) / SR) * env_exp(d, .04)
def hat(v=1): d = .04; return crush(hp(noise(d), 6000) * env_exp(d, .01), 5) * v
def snare(): d = .14; return crush(bp(noise(d), 1200, 6000) * env_exp(d, .045), 5) + tri(190, d) * env_exp(d, .03) * .4

def lead(note, at, d, g=.16, duty=.25, pan=0.0, echo=True, sec_end=None):
    f = mf(m(note)); x = sq(vib(f, d), d, duty) * adsr(d, .005, .12, .55, .05) * g
    if sec_end is not None and at + d > sec_end: x = x[:max(0, int((sec_end - at) * SR))]
    put2(mus, stereo_echo(x) if echo else np.stack([x, x], 1), at)
def bass(note, at, d, g=.32):
    x = tri(mf(m(note)), d) * adsr(d, .003, .1, .8, .04) * g; put(mus, x, at, 1, 0)
def stab(notes, at, d, g=.06, duty=.125, pan=0.0):
    for i, n in enumerate(notes): put(mus, sq(mf(m(n)), d, duty) * adsr(d, .002, .05, .3, .03) * g, at, 1, pan + (i - 1) * .25)

SEC = {e['name']: (e['t'], e['t1']) for e in EV if e['type'] == 'mus'}
B = .5   # 120 bpm

# —— title: the motif, whistled (pulse 25 % + vibrato + echo) over boom-chick ——
MOTIF = [('E5', 0, 1), ('A5', 1, 1.5), ('G5', 2.5, .5), ('E5', 3, 1), ('D5', 4, .5), ('E5', 4.5, .5), ('A4', 5, 2.5)]
t0, t1 = SEC['title']; t0 = .75
for n, b, l in MOTIF: lead(n, t0 + b * B, l * B, sec_end=t1)
for k in range(7):
    at = t0 + k * B
    if at >= t1: break
    bass(['A2', 'E2'][k % 2], at, B * .9) if k % 2 == 0 else stab(['A3', 'C4', 'E4'], at, B * .4)
# —— street: walking bass, chord stabs on the off-beats, motif answered ——
t0, t1 = SEC['street']; CH = [['A3', 'C4', 'E4'], ['G3', 'B3', 'D4'], ['F3', 'A3', 'C4'], ['E3', 'G#3', 'B3']]
BS = [['A2', 'E2'], ['G2', 'D2'], ['F2', 'C3'], ['E2', 'B1']]
k = 0
while t0 + k * B < t1 - .05:
    at = t0 + k * B; bar = (k // 4) % 4
    bass(BS[bar][k % 2], at, B * .8); stab(CH[bar], at + B / 2, B * .35, pan=.2)
    put(mus, hat(.5), at + B / 2, .5, .3)
    if k % 4 == 0: put(mus, kick(), at, .35)
    k += 1
ANS = [('A4', 4, .5), ('C5', 4.5, .5), ('E5', 5, 1), ('D5', 6, .5), ('C5', 6.5, .5), ('B4', 7, 1), ('C5', 8, .5), ('B4', 8.5, .5), ('A4', 9, 1), ('G#4', 10, 1), ('E4', 11, 2)]
for n, b, l in ANS: lead(n, t0 + b * B, l * B, g=.13, duty=.125, sec_end=t1)
# —— battle: tense triangle ostinato in eighths, noise hats, tritone stabs on each bar ——
t0, t1 = SEC['battle']; OST = ['A2', 'A2', 'E3', 'A2', 'F3', 'A2', 'E3', 'D#3']
k = 0
while t0 + k * B / 2 < t1 - .05:
    at = t0 + k * B / 2
    bass(OST[k % 8], at, B / 2 * .85, .3)
    put(mus, hat(.7 if k % 2 else .35), at, .45, .25)
    if k % 8 == 0: stab(['A3', 'D#4'], at, B * 1.5, .07, .5); put(mus, kick(), at, .4)
    if k % 8 == 4: put(mus, snare(), at, .25, -.1)
    k += 1
for n, b, l in [('E5', 8, 2), ('F5', 10, 1), ('E5', 11, 1), ('D#5', 12, 4)]: lead(n, t0 + b * B, l * B, g=.08, duty=.5)
# —— fanfare (item get): quick A-major arpeggio, held chord ——
t0, t1 = SEC['fanfare']
for i, n in enumerate(['A4', 'C#5', 'E5', 'A5']): lead(n, t0 + i * .1, .1, g=.15, duty=.5, echo=False)
for n, g in [('A5', .13), ('E5', .08), ('C#5', .07)]: lead(n, t0 + .45, 1.2, g=g, duty=.5)
bass('A2', t0 + .45, 1.2, .3); put(mus, kick(), t0 + .45, .4)
# —— sunset: the motif in A major, slower (≈ 80 bpm), echo; resolves and rings to zero ——
t0, t1 = SEC['sunset']; Bs = .75
SUN = [('E5', 0, 1), ('A5', 1, 1.5), ('G#5', 2.5, .5), ('E5', 3, 1), ('F#5', 4, .5), ('E5', 4.5, .5), ('A4', 5, 3)]
for n, b, l in SUN: lead(n, t0 + b * Bs, l * Bs, g=.14, duty=.25)
for i, n in enumerate(['A2', 'D3', 'E3', 'A2']): bass(n, t0 + i * 2 * Bs, 2 * Bs * .95, .26)
for i, ch in enumerate([['A3', 'C#4', 'E4'], ['D4', 'F#4', 'A4'], ['E4', 'G#4', 'B4'], ['A3', 'C#4', 'E4']]):
    for j in range(2): stab(ch, t0 + (i * 2 + j) * Bs + Bs / 2, Bs * .3, .05)
mus[int(47.2 * SR):] *= 0

# —— dialog ducking (music −8 dB under typed dialog) ——
dl = [(18.25, 22.0 + 15 / 30 + .4)]
g = np.ones(N)
for a, b in dl: g[int(a * SR):int(b * SR)] = .4
g = np.convolve(g, np.ones(2400) / 2400, mode='same'); mus *= g[:, None]

# —— foley ——
def gunshot(big=1):
    d = 1.4; nz = noise(d); x = np.zeros_like(nz)
    for i in range(0, len(nz), 960): f = 7000 * np.exp(-i / SR * 6) + 300; seg = lp(nz[max(0, i - 2000):i + 960], f)[-960:]; x[i:i + len(seg)] = seg
    x = crush(norm(x) * env_exp(d, .12 if big else .07), 6, 22050) + np.sin(2 * np.pi * 55 * t_(d)) * env_exp(d, .09) * .8
    return stereo_echo(x * .8, ((.21, .45, -.6), (.37, .3, .6), (.58, .18, -.2), (.82, .1, .3)))
def ricochet():
    d = .6; f = 3200 * np.exp(-t_(d) * 2.5) + 900; return crush(sq(f, d, .5) * env_exp(d, .18) * .12, 5)
def bell():
    d = 3.0; tt = t_(d)
    x = sum(a * np.sign(np.sin(2 * np.pi * f * tt)) * env_exp(d, tau) for f, a, tau in [(392, .5, 1.2), (784 * 1.19, .25, .7), (588, .25, .9), (196, .3, 1.5)])
    return stereo_echo(lp(x, 4000) * .22, ((.25, .35, -.5), (.5, .2, .5), (.75, .1, 0)))
def blip(f, duty=.25): return crush(sq(f * (1 + .04 * rng.standard_normal()), .03, duty) * adsr(.03, .001, .02, .4, .01), 5) * .18
for e in EV:
    t, ty = e['t'], e['type']; pan = e.get('pan', 0)
    if ty == 'shot': put2(fx, gunshot(e.get('big', 1)), t, .9 if e.get('big') else .55)
    elif ty == 'ricochet': put(fx, ricochet(), t + .05, 1, e.get('pan', .4))
    elif ty == 'select': put(fx, np.concatenate([sq(1320, .035) * adsr(.035), sq(1760, .07) * adsr(.07)]) * .18, t, 1, 0)
    elif ty == 'cursor': put(fx, sq(1046, .035) * adsr(.035, .001, .02) * .16, t)
    elif ty in ('openUI', 'open'): put(fx, np.concatenate([sq(880, .04, .25) * adsr(.04), sq(1320, .06, .25) * adsr(.06)]) * .14, t)
    elif ty == 'blipUI': put(fx, sq(660, .022) * adsr(.022, .001, .01) * .1, t)
    elif ty == 'blipK': put(fx, blip(988), t, 1, -.3)
    elif ty == 'blipB': put(fx, blip(330, .5), t, 1, .3)
    elif ty == 'mosaic':
        d = .4; f = np.linspace(300, 1400, int(d * SR)) if e.get('up') else np.linspace(1400, 300, int(d * SR)); put(fx, crush(sq(f, d, .25) * adsr(d, .01, .1), 5, 16000) * .09, t)
    elif ty == 'step':
        d = .07; x = hp(noise(d), 600) * env_exp(d, .01) + np.sin(2 * np.pi * 140 * t_(d)) * env_exp(d, .012) * .5; put(fx, crush(norm(x) * .22 * e.get('v', 1), 6), t, 1, pan)
    elif ty == 'bootstep':
        d = .1; x = hp(noise(d), 300) * env_exp(d, .015) + np.sin(2 * np.pi * 90 * t_(d)) * env_exp(d, .02); put(fx, crush(norm(x) * .35, 6), t, 1, .5)
        put(fx, crush(sq(2400, .05, .5) * env_exp(.05, .02), 4) * .05, t + .03, 1, .5)   # spur jingle
    elif ty == 'door':
        d = .35; x = crush(lp(noise(d), 900) * env_exp(d, .05) + np.sin(2 * np.pi * 70 * t_(d)) * env_exp(d, .06), 6); put(fx, norm(x) * .4, t, 1, .5)
    elif ty == 'tumble':
        d = e['t1'] - t; x = bp(noise(d), 1500, 6000) * (0.4 + .6 * np.abs(np.sin(2 * np.pi * 3.4 * t_(d)))) * np.sin(np.pi * t_(d) / d) * .06
        n = len(x); l = np.linspace(1, 0, n); xs = np.stack([x * (1 - l) * 1.4, x * l * 1.4], 1)[:, ::-1]; put2(fx, xs, t)
    elif ty == 'swirl':
        d = e['t1'] - t; f = np.linspace(200, 2400, int(d * SR)) ** 1; x = crush(sq(f, d, .5) * np.linspace(.2, 1, int(d * SR)) * .07 + lp(noise(d), 3000) * np.linspace(0, .15, int(d * SR)), 5, 16000); put(fx, x, t)
    elif ty == 'slide': put(fx, sfx.whoosh(.22, .12) * .7, t)
    elif ty == 'heart': put(fx, sfx.heartbeat(.9) * .45, t)
    elif ty == 'bell': put2(fx, bell(), t, .6)
    elif ty == 'clatter':
        d = .25; x = sum(crush(sq(f, d, .5) * env_exp(d, .05), 4) for f in (1800, 2650, 3900)) * .05 + hp(noise(d), 2500) * env_exp(d, .03) * .15
        put(fx, x * e.get('v', 1), t, 1, pan)
    elif ty == 'crit': put(fx, crush(sq(np.linspace(1500, 300, int(.25 * SR)), .25, .5) * env_exp(.25, .1), 5) * .1, t)
    elif ty == 'spin':
        for i in range(5): put(fx, sfx.whoosh(.08, .08) * .5, t + i * .05)
        put(fx, sfx.click(1.2, .6) if hasattr(sfx, 'click') else sq(2000, .02), t + .3)
    elif ty == 'runstep':
        d = .05; x = hp(noise(d), 800) * env_exp(d, .008); put(fx, crush(norm(x) * .16, 6), t, 1, min(1, pan))
    elif ty == 'sparkle':
        out = np.zeros(int(1.0 * SR))
        for k2, f in enumerate([1568, 2093, 2637, 3136]): s = tri(f, .4) * env_exp(.4, .12); i = int(k2 * .06 * SR); out[i:i + len(s)] += s * .4
        put2(fx, stereo_echo(out * .12), t)
    elif ty == 'bitdrop':
        d = .25; f = np.linspace(800 - 150 * e['k'], 200, int(d * SR)); put(fx, crush(sq(f, d, .125) * env_exp(d, .1), 4, 11025) * .06, t)
    elif ty == 'bed' and e['name'] == 'wind':
        d = e['t1'] - t; nz = noise(d); x = bp(nz, 250, 1400) * (0.55 + .45 * np.sin(2 * np.pi * .23 * t_(d) + 1) ** 2)
        fade = np.minimum(1, np.minimum(t_(d) / .8, (d - t_(d)) / .8)); x = x * fade * .05 * e.get('gain', .5) / .5
        put2(fx, np.stack([x, np.roll(x, 900)], 1), t)

mix = mus * .9 + fx
# true silence before the shot (including echo tails)
for e in EV:
    if e['type'] == 'silence': a, b = int(e['t'] * SR), int(e['t1'] * SR); mix[a:b] = 0
mix = mix[:int(DUR * SR)]
mix = mix / max(1e-6, np.abs(mix).max()) * .89
sf.write(os.path.join(HERE, 'mix.wav'), mix.astype(np.float32), SR, subtype='FLOAT')
print('mix.wav', round(len(mix) / SR, 2), 's')
