"""Frames at given offsets after a mark, ref row above ours row.
usage: python tools/motion-at.py <refDir> <oursDir> <markIndex> <t1,t2,..> <x0,y0,x1,y1> <out.png> [scale=0.33]"""
import json, os, sys
from PIL import Image, ImageDraw
ref, ours, mi, ts, reg, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), [float(x) for x in sys.argv[4].split(',')], tuple(map(int, sys.argv[5].split(','))), sys.argv[6]
sc = float(sys.argv[7]) if len(sys.argv) > 7 else 0.33
w, h = int((reg[2]-reg[0])*sc), int((reg[3]-reg[1])*sc)
sheet = Image.new('RGB', (len(ts)*(w+4), 2*(h+16)), (255, 0, 0)); d = ImageDraw.Draw(sheet)
for row, rec in enumerate((ref, ours)):
    idx = json.load(open(os.path.join(rec, 'index.json'))); fr = sorted(idx['frames'], key=lambda f: f['t']); m = idx['marks'][mi]
    for i, t in enumerate(ts):
        f = [x for x in fr if x['t'] <= m['t'] + t][-1]
        im = Image.open(os.path.join(rec, f['name'])).crop(reg).resize((w, h))
        sheet.paste(im, (i*(w+4), row*(h+16)+14)); d.text((i*(w+4)+2, row*(h+16)), f"{'ref' if row==0 else 'ours'} +{t:.2f}", fill=(255,255,0))
sheet.save(out)
