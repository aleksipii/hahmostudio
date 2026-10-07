"""Build the KOETA macOS app icon (ICNS + iconset), UI mark and favicon from the supplied original logo."""
from pathlib import Path
from io import BytesIO
import struct
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parent.parent
logo=Image.open(root/'desktop/assets/koeta-logo-source.jpg').convert('RGBA')
BLUE=logo.getpixel((5,5))
S=4096  # supersampled canvas; macOS icon grid: 824/1024 tile, ~22.5% corner radius
def tile(size):
 pad=round(S*100/1024);body=S-2*pad
 mask=Image.new('L',(S,S),0);ImageDraw.Draw(mask).rounded_rectangle((pad,pad,S-pad-1,S-pad-1),radius=round(body*0.225),fill=255)
 art=Image.new('RGBA',(S,S),(0,0,0,0));fill=Image.new('RGBA',(body,body),BLUE)
 scale=body*0.80/1770  # blob is about 1770 px tall in the 2000 px source
 scaled=logo.resize((round(2000*scale),round(2000*scale)),Image.Resampling.LANCZOS)
 fill.paste(scaled,(round(body/2-965*scale),round(body/2-1015*scale)))
 art.paste(fill,(pad,pad));art.putalpha(mask)
 return art.resize((size,size),Image.Resampling.LANCZOS)
def png(img):
 b=BytesIO();img.save(b,format='PNG');return b.getvalue()
representations=[(b'icp4',16),(b'icp5',32),(b'icp6',64),(b'ic07',128),(b'ic08',256),(b'ic09',512),(b'ic10',1024),(b'ic11',32),(b'ic12',64),(b'ic13',256),(b'ic14',512)]
cache={};chunks=[]
for kind,size in representations:
 payload=cache.setdefault(size,png(tile(size)));chunks.append(kind+struct.pack('>I',len(payload)+8)+payload)
body=b''.join(chunks)
(root/'desktop/assets/Hahmostudio.icns').write_bytes(b'icns'+struct.pack('>I',len(body)+8)+body)
iconset=root/'desktop/assets/Hahmostudio.iconset'
for base in (16,32,128,256,512):
 for ratio in (1,2):
  (iconset/f"icon_{base}x{base}{'@2x' if ratio==2 else ''}.png").write_bytes(cache.get(base*ratio) or png(tile(base*ratio)))
(root/'desktop/assets/app-icon.png').write_bytes(png(tile(1024)))
(root/'public/branding').mkdir(parents=True,exist_ok=True)
(root/'public/branding/koeta.png').write_bytes(png(tile(256)))
(root/'public/favicon.png').write_bytes(png(tile(64)))
print('KOETA icon: ICNS 16–1024 px, iconset, app-icon.png, UI mark, favicon')
