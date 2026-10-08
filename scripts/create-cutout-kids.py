"""Hahmostudion oma paksureunainen leikkaussarjakuvasarja (CC0): Pipsa, Ville, Taru ja Ukko.

Alkuperäistä ohjelmallista grafiikkaa. Tyyli: iso pyöreä pää, kompakti vartalo, lyhyet jalat, paksu musta ääriviiva,
litteät värit, valkoiset soikeat silmät ja mustat pupillit. Osat peittävät toisensa (kädet, lapaset ja pää ovat kiinni
vartalossa ilman rakoja), mutta jokainen osa on silti oma tasonsa nivelineen, joten IK, kävely ja eleet toimivat.
Ei minkään TV-sarjan hahmoja, asuja, tunnuksia tai tekstejä: omat hahmot, värit ja asusteet.
Jokainen hahmo piirretään kolmesta kuvakulmasta (edestä, oikea ja vasen profiili).
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
INK = '#14141a'
LW = 7  # ääriviivan paksuus (600×900-koordinaateissa)

CAST = {
    'Pipsa': dict(skin='#f5cfae', top='raincoat', top_color='#f2c230', top_dark='#c99a12', pants='#2f6f8f', shoes='#c8372d', mitten='#c8372d',
                  hair='#1d1b22', hair_style='hood', brow='#1d1b22', accessory='glasses', accent='#c8372d', trim='#c8372d'),
    'Ville': dict(skin='#f6d2b6', top='sweater', top_color='#b86a2a', top_dark='#8a4a1a', pants='#2c3a5a', shoes='#4a2f1a', mitten='#f2f0ea',
                  hair='#d9631f', hair_style='curls', brow='#a44e1e', accessory='freckles', accent='#7a4b2a', trim='#7a4b2a'),
    'Taru': dict(skin='#8a5a3c', top='hoodie', top_color='#ef7a36', top_dark='#c75d20', pants='#4e6fa0', shoes='#f4f4f0', mitten='#7b4fb8',
                 hair='#231a17', hair_style='buns', brow='#231a17', accessory='headphones', accent='#7b4fb8', trim='#f6e7d6'),
    'Ukko': dict(skin='#eec3a2', top='cardigan', top_color='#8fa48a', top_dark='#6c836a', pants='#6e5845', shoes='#3e3530', mitten='#cdb68a',
                 hair='#eceae4', hair_style='bald', brow='#14141a', accessory='mustache', accent='#5b7fa6', trim='#e3d9bd'),
}

WHITE = '#ffffff'


class Pen:
    """ImageDraw 600×900-koordinaateissa; piirtää 2× kankaalle."""

    def __init__(self, im):
        self.d = ImageDraw.Draw(im)

    @staticmethod
    def _b(box):
        return [v * S for v in box]

    def ellipse(self, box, fill, outline=INK, width=LW):
        self.d.ellipse(self._b(box), fill=fill, outline=outline, width=width * S if outline else 0)

    def rr(self, box, r, fill, outline=INK, width=LW):
        self.d.rounded_rectangle(self._b(box), r * S, fill=fill, outline=outline, width=width * S if outline else 0)

    def poly(self, pts, fill, outline=INK, width=LW):
        flat = [(x * S, y * S) for x, y in pts]
        self.d.polygon(flat, fill=fill)
        if outline:
            self.d.line(flat + [flat[0]], fill=outline, width=width * S, joint='curve')

    def line(self, pts, fill=INK, width=LW):
        self.d.line([(x * S, y * S) for x, y in pts], fill=fill, width=width * S, joint='curve')

    def arc(self, box, a, b, fill=INK, width=LW):
        self.d.arc(self._b(box), a, b, fill=fill, width=width * S)

    def chord(self, box, a, b, fill, outline=None, width=LW):
        self.d.chord(self._b(box), a, b, fill=fill, outline=outline, width=width * S if outline else 0)

    def pieslice(self, box, a, b, fill, outline=None, width=LW):
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
    mit = c['mitten']

    # ── Jalat: reisi → sääri → kenkä (erilliset tasot IK:ta varten, mutta kiinni vartalossa) ──
    # Nivelkorkeudet vastaavat 3D-luurankoa (toon3d): lonkka 603, polvi 660, nilkka 732.
    for which, x in [('right', 282 if side else 262), ('left', 318 if side else 338)]:
        lab = 'Oikea' if which == 'right' else 'Vasen'
        pants = c['pants']
        layer(which + 'Thigh', lab + ' reisi', 'Vartalo', 'leg', (x, 603), 'root',
              lambda p, x=x, pants=pants: p.rr((x - 34, 584, x + 34, 676), 24, pants), joints=[(x, 660)])
        layer(which + 'Shin', lab + ' sääri', 'Vartalo', 'leg', (x, 660), which + 'Thigh',
              lambda p, x=x, pants=pants: p.rr((x - 32, 644, x + 32, 744), 22, pants), joints=[(x, 732)])

        def foot(p, x=x):
            toe = 50 if side else 34
            p.rr((x - 40, 712, x + toe, 768), 26, c['shoes'])
            if c['shoes'] == '#c8372d':  # kumisaappaan varsi
                p.rr((x - 30, 690, x + 30, 736), 12, c['shoes'])
        layer(which + 'Foot', lab + ' kenkä', 'Vartalo', 'foot', (x, 732), which + 'Shin', foot)

    # ── Vartalo ──
    def body(p):
        l, t, r, b = (252, 412, 352, 604) if side else (206, 412, 394, 604)
        cx = 300
        if c['top'] == 'raincoat':
            p.rr((l, t, r, b), 70, top)
            p.rr((l, b - 40, r, b), 24, dark)
            p.line([(cx, t + 60), (cx, b - 8)], width=5)
            for y in (480, 530, 578):
                p.dot(cx + 22, y, 9, '#7a4a1e')
        elif c['top'] == 'sweater':
            p.rr((l, t, r, b), 64, top)
            p.rr((l, b - 44, r, b), 24, dark)
            for k in range(3):
                p.line([(l + 30, t + 66 + k * 40), (r - 30, t + 66 + k * 40)], fill=dark, width=5)
        elif c['top'] == 'hoodie':
            p.rr((l, t, r, b), 64, top)
            p.rr((l + 30, 528, r - 30, 584), 24, dark, width=5)
            p.line([(cx - 20, t + 50), (cx - 24, 510)], fill=c['trim'], width=5)
            p.line([(cx + 20, t + 50), (cx + 24, 510)], fill=c['trim'], width=5)
        else:  # cardigan
            p.rr((l, t, r, b), 62, c['trim'])
            p.poly([(l + 4, t + 24), (cx - 6, t + 14), (cx - 22, b - 4), (l + 4, b - 4)], top)
            p.poly([(r - 4, t + 24), (cx + 6, t + 14), (cx + 22, b - 4), (r - 4, b - 4)], top)
            for y in (480, 526, 572):
                p.dot(cx - 40, y, 7, dark)
    layer('root', 'Vartalo', 'Vartalo', 'body', (300, 640), None, body)

    # ── Kädet: olkavarsi → kyynärvarsi → kämmen (lapanen, kiinni hihassa) ──
    # Nivelet vastaavat 3D-luurankoa: olka (±96, 435), kyynärpää 505, ranne 582.
    for which, x in [('right', 290 if side else 204), ('left', 310 if side else 396)]:
        lab = 'Oikea' if which == 'right' else 'Vasen'
        sleeve = top if c['top'] != 'cardigan' else c['top_color']
        layer(which + 'Arm', lab + ' olkavarsi', 'Vartalo', 'arm', (x, 435), 'root',
              lambda p, x=x, sl=sleeve: p.rr((x - 30, 414, x + 30, 522), 28, sl), joints=[(x, 505)])
        layer(which + 'Forearm', lab + ' kyynärvarsi', 'Vartalo', 'arm', (x, 505), which + 'Arm',
              lambda p, x=x, sl=sleeve: p.rr((x - 28, 488, x + 28, 594), 26, sl), joints=[(x, 582)])
        layer(which + 'Hand', lab + ' kämmen', 'Vartalo', 'hand', (x, 582), which + 'Forearm',
              lambda p, x=x: p.ellipse((x - 36, 546, x + 36, 618), mit))  # keskipiste = nivel (tartuntapiste osuu ranteeseen)

    # ── Pää (isompi kuin vartalo; tukka tai asuste samassa tasossa) ──
    hb = (126, 82, 474, 448) if not side else (150, 86, 450, 448)

    def head(p):
        st = c['hair_style']
        if st == 'buns':
            for bx in ([(hb[0] - 10, hb[1] - 44, hb[0] + 100, hb[1] + 66)] if side else [(hb[0] - 20, hb[1] - 38, hb[0] + 104, hb[1] + 82), (hb[2] - 104, hb[1] - 38, hb[2] + 20, hb[1] + 82)]):
                p.ellipse(bx, c['hair'])
        if st == 'hood':
            p.ellipse((hb[0] - 22, hb[1] - 26, hb[2] + 22, hb[3] + 4), top)
            p.ellipse((hb[0] + 30, hb[1] + 44, hb[2] - 30, hb[3] - 10), skin)
        else:
            p.ellipse(hb, skin)
        if side:
            p.ellipse((hb[2] - 22, 278, hb[2] + 24, 330), skin)  # nenä
            ex = (hb[0] + hb[2]) // 2 - 30
            p.ellipse((ex - 22, 270, ex + 22, 330), skin)  # korva
        if st == 'curls':
            xs = list(range(hb[0] + 10, hb[2], 46))
            for i, x0 in enumerate(xs):
                y0 = hb[1] - 30 + (10 if i % 2 else 0)
                p.ellipse((x0 - 34, y0, x0 + 34, y0 + 70), c['hair'])
            p.chord((hb[0] + 6, hb[1] + 6, hb[2] - 6, hb[1] + 130), 180, 360, c['hair'])
        elif st == 'buns':
            p.chord((hb[0] + 4, hb[1] + 2, hb[2] - 4, hb[1] + 170), 180, 360, c['hair'])
        elif st == 'bald':
            for sx in ((hb[0] - 14, hb[2] + 14) if not side else (hb[0] - 10, hb[0] + 2)):
                p.ellipse((sx - 38, 230, sx + 38, 316), c['hair'])
        if c['accessory'] == 'headphones':
            if side:
                ex = (hb[0] + hb[2]) // 2 - 30
                p.arc((ex - 80, hb[1] - 20, ex + 80, 320), 200, 345, fill=c['accent'], width=16)
                p.rr((ex - 34, 246, ex + 34, 340), 24, c['accent'])
            else:
                p.arc((hb[0] - 4, hb[1] - 30, hb[2] + 4, hb[3] - 40), 190, 350, fill=c['accent'], width=16)
                p.rr((hb[0] - 34, 240, hb[0] + 26, 340), 24, c['accent'])
                p.rr((hb[2] - 26, 240, hb[2] + 34, 340), 24, c['accent'])
        if c['accessory'] == 'freckles':
            for fx, fy in ([(392, 352), (408, 338), (416, 360)] if side else [(206, 352), (226, 366), (192, 368), (394, 352), (374, 366), (408, 368)]):
                p.dot(fx, fy, 6, '#b8693a')
        if c['accessory'] == 'mustache':
            if side:
                p.ellipse((hb[2] - 82, 346, hb[2] + 6, 392), '#e6e3dc', width=6)
            else:
                p.ellipse((222, 336, 304, 392), '#e6e3dc', width=6)
                p.ellipse((296, 336, 378, 392), '#e6e3dc', width=6)
    layer('head', 'Pää', 'Pää', 'head', (300, 444), 'root', head)

    # ── Silmät: iso valkoinen soikio, musta pupilli; räpäytys piilotettuna ──
    eye_y = 262
    eyes = [('right', 372 if side else 252), ('left', 394 if side else 348)]
    for which, x in eyes:
        far = side and which == 'right'
        lab = 'Oikea' if which == 'right' else 'Vasen'
        blank = lambda p: None

        def white(p, x=x):
            p.ellipse((x - 42, eye_y - 52, x + 42, eye_y + 52), WHITE, width=6)

        def pupil(p, x=x, which=which):
            dx = 14 if side else (-10 if which == 'left' else 10)
            p.dot(x + dx, eye_y + 4, 11, INK)

        def brow(p, x=x, which=which):
            tilt = -5 if which == 'right' else 5
            p.line([(x - 30, eye_y - 74 + tilt), (x + 30, eye_y - 74 - tilt)], fill=c['brow'], width=8)

        def blink(p, x=x):
            p.ellipse((x - 44, eye_y - 54, x + 44, eye_y + 54), skin, outline=None)
            p.arc((x - 34, eye_y - 22, x + 34, eye_y + 18), 20, 160, fill=INK, width=7)
        layer(which + 'Eye', lab + ' silmä', 'Pää', 'eye', (x, eye_y), 'head', blank if far else white)
        layer(which + 'Pupil', lab + ' pupilli', 'Pää', 'eye', (x, eye_y + 4), 'head', blank if far else pupil)
        layer(which + 'Brow', lab + ' kulmakarva', 'Pää', 'accessory', (x, eye_y - 74), 'head', blank if far else brow)
        layer(which + 'Blink', lab + ' räpäytys', 'Pää', 'eye', (x, eye_y), 'head', blank if far else blink, hidden=True)

    if c['accessory'] == 'glasses':
        def glasses(p):
            if side:
                p.ellipse((324, eye_y - 62, 420, eye_y + 62), None, outline=c['accent'], width=9)
                p.line([(324, eye_y - 6), (240, eye_y - 16)], fill=c['accent'], width=8)
            else:
                p.ellipse((196, eye_y - 62, 306, eye_y + 62), None, outline=c['accent'], width=9)
                p.ellipse((294, eye_y - 62, 404, eye_y + 62), None, outline=c['accent'], width=9)
        layer('glasses', 'Silmälasit', 'Pää', 'accessory', (300, eye_y), 'head', glasses)

    # ── Suut ──
    mx, my = (418, 372) if side else (300, 376)
    if c['accessory'] == 'mustache':
        my = 396
    layer('mouthNeutral', 'Suu lepo', 'Suut', 'mouth', (mx, my), 'head', lambda p: p.arc((mx - 34, my - 22, mx + 34, my + 14), 25, 155, width=8))
    layer('mouthOpen', 'Suu auki', 'Suut', 'mouth', (mx, my), 'head',
          lambda p: (p.ellipse((mx - 30, my - 20, mx + 30, my + 36), '#5a1f24'), p.chord((mx - 20, my + 6, mx + 20, my + 36), 180, 360, '#e0736f')), hidden=True)
    layer('mouthRound', 'Suu pyöreä', 'Suut', 'mouth', (mx, my), 'head', lambda p: p.ellipse((mx - 17, my - 18, mx + 17, my + 22), '#5a1f24'), hidden=True)
    layer('mouthSmile', 'Suu hymy', 'Suut', 'mouth', (mx, my), 'head',
          lambda p: (p.chord((mx - 40, my - 26, mx + 40, my + 34), 0, 180, '#5a1f24', outline=INK), p.chord((mx - 32, my - 4, mx + 32, my + 14), 0, 180, WHITE)), hidden=True)
    layer('mouthSad', 'Suu suru', 'Suut', 'mouth', (mx, my), 'head',
          lambda p: (p.arc((mx - 34, my - 2, mx + 34, my + 36), 200, 340, width=8), p.dot(mx - 32, my + 12, 4, INK), p.dot(mx + 32, my + 12, 4, INK)), hidden=True)

    # Lähempi käsi profiilissa vartalon eteen, kauempi taakse.
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
