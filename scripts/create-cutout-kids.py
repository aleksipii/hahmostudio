"""Hahmostudion oma litteä leikkaushahmosarja (CC0): Pipsa, Ville, Taru ja Ukko.

Alkuperäistä ohjelmallista grafiikkaa. Isopäinen leikkaustyyli, mutta ei minkään TV-sarjan
hahmoja, asuja tai tunnusmerkkejä: erilliset silmät värillisillä iiriksillä, omat pään muodot,
asut ja värit. Jokainen hahmo piirretään kolmesta kuvakulmasta (edestä, oikea ja vasen profiili).
Taso piirretään 2× koossa ja pienennetään Lanczos-suotimella, jolloin reunat ovat pehmeät.

Tuottaa .cutout-kids-build/<Nimi>/<kulma>/{<taso>.png,<taso>.rgba,layers.json,preview.png,composite.rgba}.
Paketointi PSD:ksi ja .hahmo-projektiksi: node scripts/create-cutout-kids.mjs
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
import json

W, H, S = 600, 900, 2
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / '.cutout-kids-build'
INK = '#23262d'

CAST = {
    'Pipsa': dict(skin='#f3c9a8', hair='#1d1b22', iris='#3f7f5e', head='egg', hair_style='bob', top='raincoat', top_color='#f2c230', top_dark='#c99a12',
                  trim='#2f6f8f', pants='#2f6f8f', shorts=False, sock=None, shoes='#c8372d', brow='#1d1b22', accessory='glasses', accent='#c8372d'),
    'Ville': dict(skin='#f6d2b6', hair='#c8642a', iris='#4a6fb3', head='squircle', hair_style='curls', top='sweater', top_color='#d39b2a', top_dark='#a8771a',
                  trim='#7a4b2a', pants='#2c3a5a', shorts=True, sock='#f2f0ea', shoes='#6b3f22', brow='#a44e1e', accessory='freckles', accent='#7a4b2a'),
    'Taru': dict(skin='#8a5a3c', hair='#231a17', iris='#5a3a22', head='round', hair_style='buns', top='hoodie', top_color='#ef7a36', top_dark='#c75d20',
                 trim='#f6e7d6', pants='#4e6fa0', shorts=False, sock=None, shoes='#f4f4f0', brow='#231a17', accessory='headphones', accent='#7b4fb8'),
    'Ukko': dict(skin='#eec3a2', hair='#eceae4', iris='#6c7a86', head='oval', hair_style='bald', top='cardigan', top_color='#cdb68a', top_dark='#a8915f',
                 trim='#5b7fa6', pants='#6e5845', shorts=False, sock=None, shoes='#3e3530', brow='#d9d6cf', accessory='mustache', accent='#5b7fa6'),
}


class Pen:
    """ImageDraw 600×900-koordinaateissa; piirtää 2× kankaalle."""

    def __init__(self, im):
        self.d = ImageDraw.Draw(im)

    @staticmethod
    def _b(box):
        return [v * S for v in box]

    def ellipse(self, box, fill, outline=INK, width=3):
        self.d.ellipse(self._b(box), fill=fill, outline=outline, width=width * S if outline else 0)

    def rr(self, box, r, fill, outline=INK, width=3):
        self.d.rounded_rectangle(self._b(box), r * S, fill=fill, outline=outline, width=width * S if outline else 0)

    def poly(self, pts, fill, outline=INK, width=3):
        flat = [(x * S, y * S) for x, y in pts]
        self.d.polygon(flat, fill=fill)
        if outline:
            self.d.line(flat + [flat[0]], fill=outline, width=width * S, joint='curve')

    def line(self, pts, fill=INK, width=3):
        self.d.line([(x * S, y * S) for x, y in pts], fill=fill, width=width * S, joint='curve')

    def arc(self, box, a, b, fill=INK, width=3):
        self.d.arc(self._b(box), a, b, fill=fill, width=width * S)

    def chord(self, box, a, b, fill, outline=None, width=3):
        self.d.chord(self._b(box), a, b, fill=fill, outline=outline, width=width * S if outline else 0)

    def pieslice(self, box, a, b, fill, outline=None, width=3):
        self.d.pieslice(self._b(box), a, b, fill=fill, outline=outline, width=width * S if outline else 0)

    def dot(self, x, y, r, fill):
        self.d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=fill)


def build(name, c, view):
    out = OUT / name / view
    out.mkdir(parents=True, exist_ok=True)
    side = view != 'front'
    layers = []

    def layer(key, label, group, role, pivot, parent, draw, hidden=False, joints=()):
        big = Image.new('RGBA', (W * S, H * S))
        draw(Pen(big))
        im = big.resize((W, H), Image.LANCZOS)
        piv, jts = pivot, list(joints)
        if view == 'left':
            im = ImageOps.mirror(im)
            piv = (W - pivot[0], pivot[1])
            jts = [(W - x, y) for x, y in jts]
        box = im.getbbox()
        if not box:
            # Kaukainen silmä profiilissa: yksi lähes näkymätön pikseli pitää tason ja roolin olemassa.
            im.putpixel((300, 270), (0, 0, 0, 1))
            box = im.getbbox()
        crop = im.crop(box)
        crop.save(out / f'{key}.png')
        (out / f'{key}.rgba').write_bytes(crop.tobytes())
        layers.append(dict(key=key, name=label, group=group, role=role, pivot=dict(x=piv[0], y=piv[1]), parentKey=parent,
                           joints=[dict(x=x, y=y) for x, y in jts], left=box[0], top=box[1], width=crop.width, height=crop.height, hidden=hidden))

    skin, top, dark = c['skin'], c['top_color'], c['top_dark']

    # ── Jalat: reisi → sääri → kenkä (erilliset osat, stance-IK) ──
    for which, x in [('right', 284 if side else 262), ('left', 316 if side else 338)]:
        lab = 'Oikea' if which == 'right' else 'Vasen'
        pants, low = c['pants'], (c['skin'] if c['shorts'] else c['pants'])
        layer(which + 'Thigh', lab + ' reisi', 'Vartalo', 'leg', (x, 640), 'root',
              lambda p, x=x, pants=pants: p.rr((x - 25, 618, x + 25, 724), 22, pants), joints=[(x, 708)])

        def shin(p, x=x, low=low):
            p.rr((x - 22, 690, x + 22, 800), 20, low)
            if c['sock']:
                p.rr((x - 22, 752, x + 22, 800), 10, c['sock'])
                p.line([(x - 20, 764), (x + 20, 764)], fill=c['trim'], width=4)
        layer(which + 'Shin', lab + ' sääri', 'Vartalo', 'leg', (x, 708), which + 'Thigh', shin, joints=[(x, 792)])

        def foot(p, x=x):
            toe = 44 if side else 30
            p.rr((x - 30, 780, x + toe, 818), 14, c['shoes'])
            p.line([(x - 26, 808), (x + toe - 4, 808)], fill=INK if c['shoes'] != '#f4f4f0' else '#b9b9b2', width=3)
            if c['shoes'] == '#c8372d':  # kumisaappaan varsi
                p.rr((x - 24, 756, x + 24, 792), 8, c['shoes'])
        layer(which + 'Foot', lab + ' kenkä', 'Vartalo', 'foot', (x, 792), which + 'Shin', foot)

    # ── Vartalo ──
    def body(p):
        if side:
            bx = (250, 420, 352, 664)
        else:
            bx = (206, 420, 394, 664)
        l, t, r, b = bx
        if c['top'] == 'raincoat':
            p.poly([(l + 18, t), (r - 18, t), (r + 10, b), (l - 10, b)], top)
            p.line([(300, t + 10), (300, b - 6)], fill=dark, width=4)
            for y in (470, 528, 586):
                p.rr((306, y, 330, y + 10), 4, '#7a4a1e', width=2)
            p.rr((l - 4, t - 14, r + 4, t + 18), 14, dark)  # käännetty huppu kauluksena
        elif c['top'] == 'sweater':
            p.rr(bx, 36, top)
            p.rr((l, b - 34, r, b), 12, dark)  # resori
            for k in range(3):
                p.line([(l + 14, t + 70 + k * 46), (r - 14, t + 70 + k * 46)], fill=dark, width=3)
            p.ellipse((280, t - 6, 320, t + 22), skin)
        elif c['top'] == 'hoodie':
            p.rr(bx, 30, top)
            p.rr((l + 30, 560, r - 30, 622), 18, dark, width=2)  # tasku
            p.line([(282, t + 16), (278, 520)], fill=c['trim'], width=4)
            p.line([(318, t + 16), (322, 520)], fill=c['trim'], width=4)
            p.dot(278, 522, 6, c['trim'])
            p.dot(322, 522, 6, c['trim'])
            p.rr((l + 10, t - 16, r - 10, t + 22), 18, dark)  # huppu niskassa
        else:  # cardigan avoimena paidan päällä
            p.rr(bx, 30, c['trim'])
            p.poly([(l, t + 10), (292, t + 6), (276, b), (l, b)], top)
            p.poly([(r, t + 10), (308, t + 6), (324, b), (r, b)], top)
            for y in (488, 540, 592):
                p.dot(266, y, 5, dark)
            p.line([(292, t + 6), (276, b)], fill=INK, width=3)
            p.line([(308, t + 6), (324, b)], fill=INK, width=3)
    layer('root', 'Vartalo', 'Vartalo', 'body', (300, 640), None, body)

    # ── Kädet: olkavarsi → kyynärvarsi → kämmen ──
    for which, x in [('right', 288 if side else 186), ('left', 312 if side else 414)]:
        lab = 'Oikea' if which == 'right' else 'Vasen'
        sleeve = top if c['top'] != 'cardigan' else c['top_color']
        layer(which + 'Arm', lab + ' olkavarsi', 'Vartalo', 'arm', (x, 448), 'root',
              lambda p, x=x, sl=sleeve: p.rr((x - 25, 430, x + 25, 540), 22, sl), joints=[(x, 526)])

        def fore(p, x=x, sl=sleeve):
            p.rr((x - 23, 508, x + 23, 610), 20, sl)
            if c['top'] == 'sweater':
                p.rr((x - 23, 584, x + 23, 610), 8, dark)
            if c['top'] == 'raincoat':
                p.line([(x - 21, 592), (x + 21, 592)], fill=dark, width=4)
        layer(which + 'Forearm', lab + ' kyynärvarsi', 'Vartalo', 'arm', (x, 526), which + 'Arm', fore, joints=[(x, 600)])

        def hand(p, x=x, which=which):
            p.ellipse((x - 25, 588, x + 25, 636), skin)
            nub = -1 if which == 'right' else 1
            if side:
                nub = 1
            p.ellipse((x + nub * 14 - 9, 584, x + nub * 14 + 9, 604), skin)  # peukalo erottaa leikkaustyylin lapasista
        layer(which + 'Hand', lab + ' kämmen', 'Vartalo', 'hand', (x, 600), which + 'Forearm', hand)

    # ── Pää ──
    if c['head'] == 'egg':
        hb = (178, 118, 422, 434) if not side else (196, 122, 414, 432)
    elif c['head'] == 'squircle':
        hb = (156, 150, 444, 430) if not side else (184, 150, 420, 430)
    elif c['head'] == 'round':
        hb = (160, 146, 440, 430) if not side else (182, 146, 418, 430)
    else:
        hb = (176, 128, 424, 436) if not side else (192, 130, 414, 436)

    def head(p):
        p.rr((280, 404, 320, 446), 10, skin)  # kaula
        st = c['hair_style']
        if st == 'buns':
            for bx in ([(hb[0] - 18, hb[1] - 30, hb[0] + 82, hb[1] + 66)] if side else [(hb[0] - 26, hb[1] - 34, hb[0] + 80, hb[1] + 66), (hb[2] - 80, hb[1] - 34, hb[2] + 26, hb[1] + 66)]):
                p.ellipse(bx, c['hair'])
        if st == 'bob':
            p.rr((hb[0] - 16, hb[1] + 20, hb[2] + 16, hb[3] - 70), 90, c['hair'])
        if c['head'] == 'squircle':
            p.rr(hb, 112, skin)
        else:
            p.ellipse(hb, skin)
        if side:
            p.ellipse((hb[2] - 18, 268, hb[2] + 22, 318), skin)  # nenä
            ex = (hb[0] + hb[2]) // 2 - 34
            p.ellipse((ex - 16, 266, ex + 16, 314), skin)  # korva
            p.arc((ex - 8, 276, ex + 8, 304), 100, 260, fill=INK, width=3)
        else:
            p.ellipse((hb[0] - 14, 262, hb[0] + 18, 310), skin)
            p.ellipse((hb[2] - 18, 262, hb[2] + 14, 310), skin)
        if st == 'bob':
            p.chord((hb[0] - 6, hb[1] - 8, hb[2] + 6, hb[1] + 190), 180, 360, c['hair'])
            p.line([(hb[0] + 10, hb[1] + 92), (hb[2] - 10, hb[1] + 92)], fill=c['hair'], width=10)  # suora otsatukka
        elif st == 'curls':
            xs = range(hb[0] - 4, hb[2] + 8, 34)
            for i, x0 in enumerate(xs):
                y0 = hb[1] - 26 + (8 if i % 2 else 0)
                p.ellipse((x0 - 26, y0, x0 + 26, y0 + 56), c['hair'])
            p.chord((hb[0] + 2, hb[1] - 4, hb[2] - 2, hb[1] + 120), 180, 360, c['hair'], outline=None)
        elif st == 'buns':
            p.chord((hb[0] + 2, hb[1] - 2, hb[2] - 2, hb[1] + 150), 180, 360, c['hair'])
            p.line([(300, hb[1] + 2), (300, hb[1] + 52)], fill='#3a2c27', width=3) if not side else None
        else:  # kalju, valkoiset sivutukat
            p.arc((hb[0] + 40, hb[1] + 20, hb[2] - 40, hb[1] + 110), 200, 340, fill='#e2b090', width=3)
            if side:
                p.ellipse((hb[0] + 30, 212, hb[0] + 106, 276), c['hair'])
            else:
                p.ellipse((hb[0] - 8, 206, hb[0] + 54, 270), c['hair'])
                p.ellipse((hb[2] - 54, 206, hb[2] + 8, 270), c['hair'])
        if c['accessory'] == 'headphones':
            if side:
                ex = (hb[0] + hb[2]) // 2 - 34
                p.arc((ex - 60, hb[1] - 18, ex + 60, 300), 200, 345, fill=c['accent'], width=12)
                p.rr((ex - 26, 252, ex + 26, 328), 18, c['accent'])
            else:
                p.arc((hb[0] - 4, hb[1] - 30, hb[2] + 4, hb[3] - 60), 190, 350, fill=c['accent'], width=12)
                p.rr((hb[0] - 26, 248, hb[0] + 20, 326), 16, c['accent'])
                p.rr((hb[2] - 20, 248, hb[2] + 26, 326), 16, c['accent'])
        if c['accessory'] == 'freckles':
            for fx, fy in ([(372, 330), (388, 318), (396, 338)] if side else [(232, 330), (246, 342), (220, 344), (354, 330), (368, 342), (380, 328)]):
                p.dot(fx, fy, 4, '#c9784a')
        if c['accessory'] == 'mustache':
            if side:
                p.ellipse((hb[2] - 58, 322, hb[2] - 4, 352), c['hair'], width=2)
            else:
                p.ellipse((240, 318, 302, 352), c['hair'], width=2)
                p.ellipse((298, 318, 360, 352), c['hair'], width=2)
    layer('head', 'Pää', 'Pää', 'head', (300, 440), 'root', head)

    # ── Silmät: erilliset, värillinen iiris, räpäytys piilotettuna ──
    eye_y = 270 if c['head'] != 'egg' else 262
    eyes = [('right', 360 if side else 252), ('left', 368 if side else 348)]
    for which, x in eyes:
        far = side and which == 'right'
        lab = 'Oikea' if which == 'right' else 'Vasen'
        blank = lambda p: None

        def white(p, x=x):
            p.ellipse((x - 30, eye_y - 32, x + 30, eye_y + 32), '#fffdf6', width=3)

        def pupil(p, x=x):
            dx = 8 if side else 0
            p.dot(x + dx, eye_y + 2, 16, c['iris'])
            p.dot(x + dx, eye_y + 2, 8, INK)
            p.dot(x + dx + 5, eye_y - 4, 4, '#ffffff')

        def brow(p, x=x, which=which):
            tilt = -4 if which == 'right' else 4
            thick = 9 if c['accessory'] == 'mustache' else 6
            p.line([(x - 26, eye_y - 50 + tilt), (x + 26, eye_y - 50 - tilt)], fill=c['brow'], width=thick)

        def blink(p, x=x):
            p.ellipse((x - 32, eye_y - 34, x + 32, eye_y + 34), skin, outline=None)
            p.arc((x - 26, eye_y - 18, x + 26, eye_y + 14), 20, 160, fill=INK, width=4)
        layer(which + 'Eye', lab + ' silmä', 'Pää', 'eye', (x, eye_y), 'head', blank if far else white)
        layer(which + 'Pupil', lab + ' pupilli', 'Pää', 'eye', (x, eye_y + 2), 'head', blank if far else pupil)
        layer(which + 'Brow', lab + ' kulmakarva', 'Pää', 'accessory', (x, eye_y - 50), 'head', blank if far else brow)
        layer(which + 'Blink', lab + ' räpäytys', 'Pää', 'eye', (x, eye_y), 'head', blank if far else blink, hidden=True)

    if c['accessory'] == 'glasses':
        def glasses(p):
            if side:
                p.ellipse((326, eye_y - 38, 404, eye_y + 38), None, outline=c['accent'], width=6)
                p.line([(326, eye_y - 6), (270, eye_y - 14)], fill=c['accent'], width=5)
            else:
                p.ellipse((212, eye_y - 40, 292, eye_y + 40), None, outline=c['accent'], width=6)
                p.ellipse((308, eye_y - 40, 388, eye_y + 40), None, outline=c['accent'], width=6)
                p.line([(292, eye_y - 4), (308, eye_y - 4)], fill=c['accent'], width=5)
        layer('glasses', 'Silmälasit', 'Pää', 'accessory', (300, eye_y), 'head', glasses)

    # ── Suut ──
    mx, my = (388, 352) if side else (300, 352)
    if c['accessory'] == 'mustache':
        my = 362
    layer('mouthNeutral', 'Suu lepo', 'Suut', 'mouth', (mx, my), 'head', lambda p: p.arc((mx - 22, my - 14, mx + 22, my + 10), 25, 155, width=4))
    layer('mouthOpen', 'Suu auki', 'Suut', 'mouth', (mx, my), 'head',
          lambda p: (p.ellipse((mx - 20, my - 14, mx + 20, my + 22), '#5a1f24'), p.chord((mx - 14, my + 4, mx + 14, my + 22), 180, 360, '#e0736f')), hidden=True)
    layer('mouthRound', 'Suu pyöreä', 'Suut', 'mouth', (mx, my), 'head', lambda p: p.ellipse((mx - 11, my - 12, mx + 11, my + 14), '#5a1f24'), hidden=True)
    layer('mouthSmile', 'Suu hymy', 'Suut', 'mouth', (mx, my), 'head',
          lambda p: (p.chord((mx - 26, my - 18, mx + 26, my + 22), 0, 180, '#5a1f24', outline=INK), p.chord((mx - 20, my - 4, mx + 20, my + 8), 0, 180, '#fffdf6')), hidden=True)
    layer('mouthSad', 'Suu suru', 'Suut', 'mouth', (mx, my), 'head',
          lambda p: (p.arc((mx - 22, my - 2, mx + 22, my + 24), 200, 340, width=4), p.dot(mx - 20, my + 8, 2, INK), p.dot(mx + 20, my + 8, 2, INK)), hidden=True)

    # Lähempi käsi profiilissa vartalon eteen, kauempi taakse.
    order = [n['key'] for n in layers]
    if side:
        near = [n for n in layers if n['key'] in ('leftArm', 'leftForearm', 'leftHand')]
        far = [n for n in layers if n['key'] in ('rightArm', 'rightForearm', 'rightHand')]
        rest = [n for n in layers if n not in near and n not in far]
        at = next(i for i, n in enumerate(rest) if n['key'] == 'root')
        layers[:] = rest[:at] + far + [rest[at]] + near + rest[at + 1:]

    composite = Image.new('RGBA', (W, H))
    for n in layers:
        if not n['hidden']:
            composite.alpha_composite(Image.open(out / (n['key'] + '.png')), (n['left'], n['top']))
    composite.save(out / 'preview.png')
    (out / 'composite.rgba').write_bytes(composite.tobytes())
    (out / 'layers.json').write_text(json.dumps(layers, ensure_ascii=False))
    return len(layers)


if __name__ == '__main__':
    for name, cfg in CAST.items():
        counts = [build(name, cfg, v) for v in ('front', 'right', 'left')]
        print(f'{name}: {counts[0]} tasoa × 3 kuvakulmaa')
