from PIL import Image,ImageDraw
import json
from pathlib import Path
for b in json.loads(Path('.character-build/backgrounds.json').read_text()):
 im=Image.new('RGB',(1080,1920));d=ImageDraw.Draw(im)
 for s in b['shapes']:
  if 'gradient' in s:
   def rgb(v):return tuple(int(v[i:i+2],16) for i in (1,3,5))
   a,z=map(rgb,s['gradient'])
   for y in range(1920):d.line((0,y,1080,y),fill=tuple(round(x+(v-x)*y/1920) for x,v in zip(a,z)))
  elif 'rect' in s:
   x,y,w,h=s['rect'];d.rectangle((x*1080,y*1920,(x+w)*1080,(y+h)*1920),fill=s['fill'])
  elif 'ellipse' in s:
   x,y,rx,ry=s['ellipse'];d.ellipse(((x-rx)*1080,(y-ry)*1920,(x+rx)*1080,(y+ry)*1920),fill=s['fill'])
  else:d.polygon([(x*1080,y*1920) for x,y in s['points']],fill=s['fill'])
 im.save(Path('public/library')/(b['id']+'.png'))
