"""Compare dither captures: pixel match, lit fraction, grey levels, dot lattice, feature scale, drift.
usage: python tools/dither-stats.py <dir> <t1,t2,...> [region=1060,60,1420,500]"""
import sys, numpy as np
from PIL import Image
d, ts = sys.argv[1], sys.argv[2].split(',')
reg = tuple(map(int, (sys.argv[3] if len(sys.argv) > 3 else '1060,60,1420,500').split(',')))
def load(k, t): return np.asarray(Image.open(f'{d}/{k}-{t}.png').convert('RGB').crop(reg)).astype(np.int16)
def lum(a): return a.mean(2)
def blur(a, r=12):
    k = np.ones(r) / r
    a = np.apply_along_axis(lambda x: np.convolve(x, k, 'same'), 0, a)
    return np.apply_along_axis(lambda x: np.convolve(x, k, 'same'), 1, a)
def acorr_peak(a):
    a = a - a.mean(); f = np.fft.fft2(a); ac = np.real(np.fft.ifft2(f * np.conj(f))); ac /= ac[0, 0]
    return ac
for t in ts:
    A, B = load('ref', t), load('ours', t)
    la, lb = lum(A), lum(B)
    same = (np.abs(A - B).sum(2) == 0).mean()
    print(f'--- t={t}ms  identical pixels {same*100:.1f}%  mean|diff| {np.abs(la-lb).mean():.2f}')
    for k, a, l in (('ref', A, la), ('ours', B, lb)):
        cols, cnt = np.unique(a.reshape(-1, 3), axis=0, return_counts=True)
        top = sorted(zip(cnt, map(tuple, cols)), reverse=True)[:4]
        ac = acorr_peak(l)
        lat = [round(ac[0, i], 2) for i in range(1, 6)]
        bl = blur(l, 16); acb = acorr_peak(bl)
        # feature scale: lag where blurred autocorr falls below 0.5
        scale = next((i for i in range(1, 200) if acb[0, i] < 0.5), None)
        print(f'  {k:4} lit {(l>40).mean()*100:5.1f}%  mean {l.mean():6.2f}  top colours {top}  lattice ac(1..5)={lat}  feature-scale {scale}px')
# drift between times (phase correlation of blurred luminance)
def shift(a, b):
    a = blur(a, 16); b = blur(b, 16); a -= a.mean(); b -= b.mean()
    R = np.fft.fft2(a) * np.conj(np.fft.fft2(b)); R /= np.abs(R) + 1e-9
    r = np.real(np.fft.ifft2(R)); y, x = np.unravel_index(r.argmax(), r.shape)
    if y > r.shape[0] // 2: y -= r.shape[0]
    if x > r.shape[1] // 2: x -= r.shape[1]
    return x, y, r.max()
for k in ('ref', 'ours'):
    for t1, t2 in zip(ts, ts[1:]):
        a, b = lum(load(k, t1)), lum(load(k, t2))
        print(f'  {k:4} change {t1}->{t2}: mean|diff| {np.abs(a-b).mean():.2f}  shift {shift(a, b)[:2]}')
