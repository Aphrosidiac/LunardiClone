"""Per-action motion timeline from a tools/motion.mjs recording.

For each marked action, prints the frame-to-frame change (mean abs diff, 0-255) in a region over the
next `window` seconds, so you can see when something starts moving, how long it moves, and how it
settles. Region: x0,y0,x1,y1 in 1440x900 page px (default: whole page minus the header).

usage: python tools/motion-diff.py <recDir> [window=1.5] [region=0,40,1440,900] [mask-dither=1]
"""
import json, sys, os
import numpy as np
from PIL import Image

rec = sys.argv[1]
win = float(sys.argv[2]) if len(sys.argv) > 2 else 1.5
reg = tuple(int(v) for v in (sys.argv[3] if len(sys.argv) > 3 else '0,40,1440,900').split(','))
idx = json.load(open(os.path.join(rec, 'index.json')))
frames, marks = idx['frames'], idx['marks']
cache = {}
def load(name):
    if name not in cache:
        im = Image.open(os.path.join(rec, name)).convert('L').crop(reg).resize(((reg[2]-reg[0])//2, (reg[3]-reg[1])//2))
        cache[name] = np.asarray(im, dtype=np.int16)
    return cache[name]

for m in marks:
    seq = [f for f in frames if m['t'] - 0.05 <= f['t'] <= m['t'] + win]
    out = []
    for a, b in zip(seq, seq[1:]):
        d = np.abs(load(b['name']) - load(a['name'])).mean()
        if d > 0.15:
            out.append(f"{b['t']-m['t']:+.2f}:{d:.1f}")
    print(f"{m['label']:<22} frames={len(seq):3d}  " + ' '.join(out[:40]))
