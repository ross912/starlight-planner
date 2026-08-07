#!/usr/bin/env python3
"""星光手帐 配色方案预览图：同一「总览」版式，三套配色，供 Owner 挑选"""
import math
import os
from PIL import Image, ImageDraw, ImageFont

FONTS_DIR = '/Users/midongkeji/Library/Application Support/kimi-desktop/daimon-share/daimon/runtime/python/fonts'
OUT = '/Users/midongkeji/Documents/kimi/workspace/warm-planner/branding/theme-previews'
os.makedirs(OUT, exist_ok=True)

def font(size, bold=False):
    return ImageFont.truetype(f'{FONTS_DIR}/NotoSansSC-{"Bold" if bold else "Regular"}.ttf', size)

SCHEMES = [
    {
        'file': 'A-雾杏.png', 'name': '方案 A · 雾杏（低饱和柔暖）',
        'bg1': '#F6F1EA', 'bg2': '#F1EAE1', 'side1': '#F9F2E8', 'side2': '#F3EADD',
        'card': '#FFFFFF', 'border': '#EAE0D2',
        'primary': '#D89B6A', 'primary_deep': '#B9804F', 'title': '#5C4A3A',
        'text': '#6B5B4B', 'sub': '#A29383', 'chip': '#F3E8DA', 'chip_text': '#A97C4F',
        'bar1': '#E8C79A', 'bar2': '#D89B6A', 'track': '#F1E6D6',
    },
    {
        'file': 'B-蜜桃粉.png', 'name': '方案 B · 蜜桃粉（珊瑚暖粉）',
        'bg1': '#FBF2EF', 'bg2': '#F8E9E6', 'side1': '#FBEAE6', 'side2': '#F7E0DC',
        'card': '#FFFFFF', 'border': '#F3DAD4',
        'primary': '#E8836C', 'primary_deep': '#D96B56', 'title': '#6B4440',
        'text': '#71514C', 'sub': '#B08D87', 'chip': '#FAE3DC', 'chip_text': '#C06B54',
        'bar1': '#F2A28E', 'bar2': '#E8836C', 'track': '#F6E0DA',
    },
    {
        'file': 'C-焦糖拿铁.png', 'name': '方案 C · 焦糖拿铁（咖啡深暖）',
        'bg1': '#F5F0E8', 'bg2': '#EFE8DC', 'side1': '#F3ECE0', 'side2': '#EDE3D3',
        'card': '#FFFFFF', 'border': '#E5D9C6',
        'primary': '#B07A3E', 'primary_deep': '#8F6530', 'title': '#4E3B28',
        'text': '#5D4C3A', 'sub': '#9C8B76', 'chip': '#EFE3CE', 'chip_text': '#8F6530',
        'bar1': '#D0A76C', 'bar2': '#B07A3E', 'track': '#EDE2CE',
    },
]

W, H = 1440, 900
SIDE = 232

def star_pts(cx, cy, r_out, r_in, rot=-90):
    pts = []
    for i in range(10):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(rot + i * 36)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def vgrad(draw, box, c1, c2, radius=0):
    """竖向渐变矩形（按条带绘制）"""
    x0, y0, x1, y1 = box
    h = max(1, int(y1 - y0))
    from PIL import ImageColor
    r1, g1, b1 = ImageColor.getrgb(c1)
    r2, g2, b2 = ImageColor.getrgb(c2)
    strip = Image.new('RGB', (1, h))
    px = strip.load()
    for y in range(h):
        t = y / max(1, h - 1)
        px[0, y] = (int(r1 + (r2 - r1) * t), int(g1 + (g2 - g1) * t), int(b1 + (b2 - b1) * t))
    strip = strip.resize((int(x1 - x0), h))
    if radius:
        mask = Image.new('L', strip.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, strip.size[0] - 1, strip.size[1] - 1], radius=radius, fill=255)
        return strip.convert('RGBA'), mask, (int(x0), int(y0))
    return strip.convert('RGBA'), None, (int(x0), int(y0))

def mock(p):
    im = Image.new('RGBA', (W, H), p['bg1'])
    d = ImageDraw.Draw(im)

    # 背景渐变
    grad, _, pos = vgrad(d, (0, 0, W, H), p['bg1'], p['bg2'])
    im.paste(grad, pos)

    # ---------- 侧边栏 ----------
    sg, smask, spos = vgrad(d, (0, 0, SIDE, H), p['side1'], p['side2'])
    im.paste(sg, spos, smask)
    d.line([(SIDE, 0), (SIDE, H)], fill=p['border'], width=1)

    # logo
    d.rounded_rectangle([24, 28, 68, 72], radius=12, fill=p['primary'])
    d.polygon(star_pts(46, 50, 15, 6.3), fill='#FFF8EE')
    d.text((80, 30), '星光手帐', font=font(22, True), fill=p['title'])
    d.text((80, 56), '记录生活 · 规划未来', font=font(12), fill=p['sub'])

    # 导航
    navs = ['总览', '日记', '计划', '记账', '阅读', '健身', '统计']
    y = 108
    for i, n in enumerate(navs):
        if i == 0:
            d.rounded_rectangle([16, y - 6, SIDE - 16, y + 34], radius=10, fill=p['card'])
            d.rounded_rectangle([16, y - 6, SIDE - 16, y + 34], radius=10, outline=p['border'], width=1)
        d.ellipse([30, y + 9, 40, y + 19], fill=p['primary'] if i == 0 else p['sub'])
        d.text((50, y + 2), n, font=font(15, i == 0), fill=p['primary_deep'] if i == 0 else p['text'])
        y += 44
    # 底部
    for j, t in enumerate(['✦ admin 的手帐', '导出数据备份', '邀请朋友', '修改密码', '退出登录']):
        d.text((28, H - 176 + j * 26), t, font=font(12), fill=p['sub'])
    d.text((28, H - 36), '2026年8月5日', font=font(12), fill=p['sub'])

    # ---------- 主区域 ----------
    X = SIDE + 36
    CW = W - X - 36  # 内容宽
    d.text((X, 30), '2026年8月5日 星期三', font=font(13), fill=p['sub'])
    d.text((X, 52), '下午好，继续加油', font=font(30, True), fill=p['title'])

    def card(x, y, w, h):
        d.rounded_rectangle([x, y, x + w, y + h], radius=14, fill=p['card'], outline=p['border'], width=1)

    def bar(x, y, w, h, pct):
        d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=p['track'])
        if pct > 0:
            fg, m, pos = vgrad(d, (x, y, x + max(h, w * pct), y + h), p['bar1'], p['bar2'], radius=h // 2)
            im.paste(fg, pos, m)

    # 今日计划卡
    c1w = int(CW * 0.62)
    card(X, 108, c1w, 240)
    d.text((X + 20, 124), '今日计划', font=font(16, True), fill=p['title'])
    d.text((X + 20, 126), '', font=font(16), fill=p['sub'])
    d.text((X + c1w - 110, 126), '已完成 1/3', font=font(12), fill=p['sub'])
    bar(X + 20, 152, c1w - 40, 8, 0.33)
    todos = [('完成数学作业', True), ('健身：卧推 60kg', False), ('给妈妈打电话', False)]
    ty = 176
    for txt, done in todos:
        if done:
            d.ellipse([X + 22, ty + 4, X + 40, ty + 22], fill=p['primary'])
            d.line([(X + 26, ty + 13), (X + 30, ty + 18), (X + 37, ty + 8)], fill='#FFFFFF', width=2)
            d.text((X + 50, ty + 2), txt, font=font(14), fill=p['sub'])
            tw = d.textlength(txt, font=font(14))
            d.line([(X + 50, ty + 11), (X + 50 + tw, ty + 11)], fill=p['sub'], width=1)
        else:
            d.ellipse([X + 22, ty + 4, X + 40, ty + 22], outline=p['primary'], width=2)
            d.text((X + 50, ty + 2), txt, font=font(14), fill=p['text'])
        ty += 34
    d.rounded_rectangle([X + 20, ty + 4, X + c1w - 64, ty + 38], radius=9, outline=p['border'], width=1)
    d.text((X + 32, ty + 12), '添加今日待办，回车保存', font=font(13), fill=p['sub'])
    d.rounded_rectangle([X + c1w - 56, ty + 4, X + c1w - 20, ty + 38], radius=9, fill=p['primary'])
    d.line([(X + c1w - 38, ty + 14), (X + c1w - 38, ty + 28)], fill='#FFF', width=2)
    d.line([(X + c1w - 45, ty + 21), (X + c1w - 31, ty + 21)], fill='#FFF', width=2)

    # 今日日记卡
    c2x = X + c1w + 16
    card(c2x, 108, W - 36 - c2x, 240)
    d.text((c2x + 20, 124), '今日日记', font=font(16, True), fill=p['title'])
    d.rounded_rectangle([c2x + 20, 152, c2x + 76, 174], radius=11, fill=p['chip'])
    d.text((c2x + 28, 154), '#手帐', font=font(11), fill=p['chip_text'])
    lines = ['今天给手帐加了多账号体系，', '朋友也能拥有自己的星光手帐了，', '很开心。']
    ly = 186
    for ln in lines:
        d.text((c2x + 20, ly), ln, font=font(13), fill=p['text'])
        ly += 24
    d.text((c2x + 20, 318), '继续写 →', font=font(13), fill=p['primary_deep'])

    # 统计小卡 × 5
    stats = [('连续写日记', '3', '天'), ('连续完成日计划', '2', '天'), ('日记总数', '12', '篇'), ('任务完成率', '68', '%'), ('本月结余', '¥1,280', '')]
    sy = 364
    sw = (CW - 4 * 12) // 5
    for i, (lab, val, unit) in enumerate(stats):
        sx = X + i * (sw + 12)
        card(sx, sy, sw, 86)
        d.text((sx + 16, sy + 12), lab, font=font(12), fill=p['sub'])
        d.text((sx + 16, sy + 36), val, font=font(24, True), fill=p['title'])
        d.text((sx + 16 + d.textlength(val, font=font(24, True)) + 4, sy + 46), unit, font=font(12), fill=p['sub'])

    # 五层计划进度卡
    py = sy + 102
    card(X, py, CW, 150)
    d.text((X + 20, py + 16), '五层计划进度', font=font(16, True), fill=p['title'])
    d.text((X + CW - 86, py + 18), '管理计划 →', font=font(12), fill=p['primary_deep'])
    lv = [('日计划', 0.6), ('周计划', 0.4), ('月计划', 0.3), ('年计划', 0.1), ('总计划', 0.05)]
    bw = (CW - 40 - 4 * 14) // 5
    for i, (lab, pct) in enumerate(lv):
        bx = X + 20 + i * (bw + 14)
        d.rounded_rectangle([bx, py + 48, bx + bw, py + 128], radius=10, fill=p['bg1'], outline=p['border'], width=1)
        d.text((bx + 12, py + 58), lab, font=font(13), fill=p['text'])
        d.text((bx + bw - 46, py + 58), f'{int(pct * 100)}%', font=font(12, True), fill=p['primary_deep'])
        bar(bx + 12, py + 86, bw - 24, 7, pct)
        d.text((bx + 12, py + 102), f'{int(pct * 10)}/10 项', font=font(11), fill=p['sub'])

    # 底部注释
    d.text((X, H - 34), p['name'], font=font(13, True), fill=p['primary_deep'])

    out = os.path.join(OUT, p['file'])
    im.convert('RGB').save(out, quality=92)
    print('saved', out)

for p in SCHEMES:
    mock(p)
print('done')
