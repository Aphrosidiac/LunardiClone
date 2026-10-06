"""Crop a region from every frame between t0 and t1 after a mark and tile them (for close inspection).
usage: python tools/motion-crop.py <recDir> <markIndex> <t0> <t1> <x0,y0,x1,y1> <out.png> [cols=6]"""
import json, os, sys
from PIL import Image, ImageDraw
rec, mi, t0, t1, reg, out = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), tuple(map(int, sys.argv[5].split(','))), sys.argv[6]
cols = int(sys.argv[7]) if len(sys.argv) > 7 else 6
idx = json.load(open(os.path.join(rec, 'index.json')))
m = idx['marks'][mi]
fr = [f for f in idx['frames'] if m['t'] + t0 <= f['t'] <= m['t'] + t1]
w, h = reg[2] - reg[0], reg[3] - reg[1]
rows = (len(fr) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 4), rows * (h + 18)), (255, 0, 0))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(fr):
    im = Image.open(os.path.join(rec, f['name'])).crop(reg)
    x, y = (i % cols) * (w + 4), (i // cols) * (h + 18)
    sheet.paste(im, (x, y + 16))
    d.text((x + 2, y + 2), f"{f['t'] - m['t']:+.3f}", fill=(255, 255, 0))
sheet.save(out)
print(len(fr), 'frames', m['label'])
