"""events.json → subtitle cues → gravity-tunnel.srt"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); LIB = os.environ.get('LIB') or os.path.expanduser('~/lemo-opuscar')
E = json.load(open(os.path.join(HERE, 'events.json')))
cues = [{'t0': e['t'], 't1': e['t1'], 'text': e['text']} for e in E['ev'] if e['type'] == 'sub']
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
json.dump(cues, open(os.path.join(HERE, 'out/cues.json'), 'w'), ensure_ascii=False)
subprocess.run([sys.executable, os.path.join(LIB, 'core/render/srt.py'), os.path.join(HERE, 'out/cues.json'), os.path.join(HERE, 'gravity-tunnel.srt')], check=True)
