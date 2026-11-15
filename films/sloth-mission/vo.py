"""「똥 작전」 내레이션: ElevenLabs (목소리 Adam, 모델 eleven_v3) → voice/<id>.mp3 + voice/vo.wav(30초 트랙) + voice/cues.json
- mp3는 커밋해 두므로 다시 빌드할 때 키가 필요 없다. 문장을 바꾸면 그 mp3를 지우고 다시 실행한다(api.elevenlabs.io 키 필요).
- 각 줄은 장면 창(t0~t1) 안에 들어가야 한다. 길면 최대 1.25배까지 빠르게 하고, 그래도 넘치면 실패로 멈춘다.
실행: $LIB/.venv/bin/python films/sloth-mission/vo.py"""
import os, sys, json, subprocess, urllib.request
import numpy as np, soundfile as sf

D = os.path.dirname(os.path.abspath(__file__)); V = os.path.join(D, 'voice'); os.makedirs(V, exist_ok=True)
SR = 48000; DUR = 30.0
VOICE = 'pNInz6obpgDQGcFmaJgB'   # Adam (ElevenLabs 기본 목소리)
MODEL = 'eleven_v3'

# (id, 시작, 끝(이 안에 끝나야 함), 읽을 문장, 자막 문장). 21.0~21.5는 완전 침묵이라 비워 둔다.
LINES = [
    ('v01', 0.30, 4.90, '[serious] 여기, 똥 한 번 싸려고... 계획을 세우는 동물이 있습니다.', '여기, 똥 한 번 싸려고… 계획을 세우는 동물이 있습니다.'),
    ('v02', 5.30, 7.95, '[serious] 작전명, 하강. 디데이 칠 일 전.', '작전명, 하강. D-7.'),
    ('v03', 8.00, 9.80, '맹수 구역, 절대 금지.', '맹수 구역, 절대 금지.'),
    ('v04', 10.00, 12.55, '장비 점검. 헬멧, 휴지 한 칸.', '장비 점검. 헬멧, 휴지 한 칸.'),
    ('v05', 12.60, 15.30, '[sad] 혹시 내가 못 돌아오면... [deadpan] 참고로, 매주 합니다.', '혹시 내가 못 돌아오면… 참고로, 매주 합니다.'),
    ('v07', 15.50, 17.45, '남은 거리, 십 미터.', '남은 거리, 10m.'),
    ('v08', 17.60, 20.10, '[sighs] 예상 소요 시간, 하루.', '예상 소요 시간, 하루.'),
    ('v09', 21.55, 22.45, '[whispers] 작업 중.', '(속삭임) 작업 중.'),
    ('v10', 23.55, 24.25, '임무 완수.', '임무 완수.'),
    ('v11', 24.90, 26.45, '맹수도 포기했습니다.', '맹수도 포기했습니다.'),
    ('v12', 27.00, 29.90, '돌아와 보니, 다음 작전은... 오늘입니다.', '돌아와 보니, 다음 작전은… 오늘입니다.'),
]

def tts(text, path):
    body = json.dumps({'text': text, 'model_id': MODEL, 'language_code': 'ko'}).encode()
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128', data=body, method='POST',
                                 headers={'Content-Type': 'application/json', 'xi-api-key': os.environ.get('ELEVENLABS_API_KEY', 'proxy-injected')})
    with urllib.request.urlopen(req, timeout=120) as r: open(path, 'wb').write(r.read())

def load(path, tempo=1.0):
    af = f'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse'
    if tempo != 1.0: af += f',atempo={tempo:.3f}'
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-af', af, '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()

track = np.zeros(int(DUR * SR) + SR, np.float32); cues = []; bad = []
for i, t0, t1, say, sub in LINES:
    mp3 = os.path.join(V, i + '.mp3')
    if not os.path.exists(mp3): print('tts', i); tts(say, mp3)
    x = load(mp3); room = t1 - t0; tempo = 1.0
    if len(x) / SR > room:
        tempo = min(1.25, len(x) / SR / room * 1.01); x = load(mp3, tempo)
    d = len(x) / SR
    if d > room + 0.05: bad.append((i, round(d, 2), room))
    s = int(t0 * SR); track[s:s + len(x)] += x
    cues.append({'id': i, 't0': t0, 't1': round(t0 + d, 3), 'text': sub, 'tempo': round(tempo, 3)})
    print(f'{i} {t0:5.2f}–{t0 + d:5.2f} (창 {t1:5.2f}) x{tempo:.2f}  {sub}')
if bad: sys.exit(f'창을 넘친 줄: {bad} — 문장을 줄이거나 창을 넓히세요')
track = track[:int(DUR * SR)]
sf.write(os.path.join(V, 'vo.wav'), track, SR)
json.dump(cues, open(os.path.join(V, 'cues.json'), 'w'), ensure_ascii=False, indent=1)
print('vo ok', round(float(np.abs(track).max()), 3))
