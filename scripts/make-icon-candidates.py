#!/usr/bin/env python3
"""星光手帐 图标候选第二弹：无星星 · 极简干净
A 「星」字标 / B 弯月 / C 书签手帐 / D 光斑圆点"""
import os
from PIL import Image, ImageDraw, ImageFont

FONTS_DIR = '/Users/midongkeji/Library/Application Support/kimi-desktop/daimon-share/daimon/runtime/python/fonts'
OUT = '/Users/midongkeji/Documents/kimi/workspace/warm-planner/branding/icon-candidates'
os.makedirs(OUT, exist_ok=True)

S = 1024
RADIUS = 232
ORANGE = '#F28C4B'
CREAM = '#FBF3E7'
WHITE = '#FFF9F0'
NIGHT = '#3A2E3F'

def canvas(bg):
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, S - 1, S - 1], radius=RADIUS, fill=bg)
    return im, ImageDraw.Draw(im)

# A：暖橙底 + 白色「星」字（单字标，极简有力）
im, d = canvas(ORANGE)
f = ImageFont.truetype(f'{FONTS_DIR}/NotoSansSC-Bold.ttf', 560)
bbox = d.textbbox((0, 0), '星', font=f)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
d.text(((S - tw) / 2 - bbox[0], (S - th) / 2 - bbox[1]), '星', font=f, fill=WHITE)
im.save(f'{OUT}/A-星字标.png')

# B：深夜底 + 奶油弯月（两个圆相减，干净弧线）
im, d = canvas(NIGHT)
cx, cy, r = S / 2, S / 2, S * 0.30
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill='#FFE9C4')
off = r * 0.62
d.ellipse([cx - r + off, cy - r - off * 0.35, cx + r + off, cy + r - off * 0.35], fill=NIGHT)
im.save(f'{OUT}/B-弯月.png')

# C：奶油底 + 橙色手帐本（圆角矩形 + 书签带 + 一道横线）
im, d = canvas(CREAM)
bw, bh = S * 0.44, S * 0.54
bx, by = (S - bw) / 2, (S - bh) / 2
d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=54, fill=ORANGE)
d.line([(bx + 72, by + 52), (bx + 72, by + bh - 52)], fill=WHITE, width=14)  # 书脊线
# 书签
rib_w, rib_h = 66, 150
rx = bx + bw - 72 - rib_w
d.polygon([(rx, by), (rx + rib_w, by), (rx + rib_w, by + rib_h), (rx + rib_w / 2, by + rib_h - 44), (rx, by + rib_h)], fill=WHITE)
im.save(f'{OUT}/C-书签手帐.png')

# D：暖橙底 + 白色光斑圆点（一道光）
im, d = canvas(ORANGE)
r = S * 0.21
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)
r2 = S * 0.30
d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], outline=WHITE, width=16)
im.save(f'{OUT}/D-光斑.png')
print('done')
