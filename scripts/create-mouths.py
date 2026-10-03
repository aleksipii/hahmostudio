from PIL import Image,ImageDraw
from pathlib import Path
import json
out=Path(__file__).resolve().parent.parent/'.mouth-build';out.mkdir(exist_ok=True)
for style in ['Pehmea','Sarjakuva']:
 layers=[]
 for shape in 'ABCDEFGHX':
  im=Image.new('RGBA',(160,100));d=ImageDraw.Draw(im);ink='#24364b';lip='#a84256' if style=='Pehmea' else '#24364b';white='#fff7e7'
  if shape in 'AX':d.arc((25,30,135,64 if shape=='X' else 52),0,180,fill=lip,width=7)
  elif shape=='B':d.rounded_rectangle((30,32,130,62),9,fill=lip);d.rounded_rectangle((39,39,121,53),3,fill=white);d.line((40,47,120,47),fill=ink,width=2)
  elif shape in 'CDH':
   bottom=83 if shape=='D' else 70;d.rounded_rectangle((27,20,133,bottom),20,fill=lip);d.rounded_rectangle((36,29,124,bottom-7),14,fill=ink);d.rectangle((39,26,121,37),fill=white)
   if shape=='H':d.ellipse((64,35,101,62),fill='#e18891')
   else:d.ellipse((51,bottom-25,112,bottom-8),fill='#e18891')
  elif shape in 'EF':
   box=(48,12,112,87) if shape=='E' else (60,25,100,75);d.ellipse(box,fill=lip);d.ellipse((box[0]+7,box[1]+7,box[2]-7,box[3]-7),fill=ink)
  elif shape=='G':d.arc((26,23,134,76),0,180,fill=lip,width=12);d.rectangle((37,39,123,54),fill=white)
  im.save(out/(style+'-'+shape+'.png'));(out/(style+'-'+shape+'.rgba')).write_bytes(im.tobytes());layers.append(dict(shape=shape,width=160,height=100))
 (out/(style+'.json')).write_text(json.dumps(layers))
