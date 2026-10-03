from PIL import Image,ImageDraw
from pathlib import Path
import json
out=Path(__file__).resolve().parent.parent / '.asset-build';out.mkdir(exist_ok=True);layers=[];composite=Image.new('RGBA',(600,900))
def layer(key,name,group,role,pivot,parent,draw,hidden=False,joints=[]):
 im=Image.new('RGBA',(600,900));d=ImageDraw.Draw(im);draw(d);box=im.getbbox();crop=im.crop(box);crop.save(out/(key+'.png'));(out/(key+'.rgba')).write_bytes(crop.tobytes());layers.append(dict(key=key,name=name,group=group,role=role,pivot=dict(x=pivot[0],y=pivot[1]),parentKey=parent,joints=[dict(x=x,y=y) for x,y in joints],left=box[0],top=box[1],width=crop.width,height=crop.height,hidden=hidden));
 if not hidden:composite.alpha_composite(im)
blue='#64d9dd';dark='#172d48';light='#d2f6f4';orange='#ffa972'
def pill(d,b,color,r=25):d.rounded_rectangle(b,r,fill=color,outline=dark,width=5)
for side,x in [('right',245),('left',355)]:
 layer(side+'Thigh',('Oikea' if side=='right' else 'Vasen')+' reisi','Vartalo','leg',(x,600),'root',lambda d,x=x:pill(d,(x-31,575,x+31,700),blue),joints=[(x,690)])
 layer(side+'Shin',('Oikea' if side=='right' else 'Vasen')+' sääri','Vartalo','leg',(x,690),side+'Thigh',lambda d,x=x:pill(d,(x-27,668,x+27,790),light),joints=[(x,785)])
 layer(side+'Foot',('Oikea' if side=='right' else 'Vasen')+' jalkaterä','Vartalo','foot',(x,780),side+'Shin',lambda d,x=x:pill(d,(x-42,760,x+42,810),dark,18))
for side,x in [('right',191),('left',409)]:
 layer(side+'Arm',('Oikea' if side=='right' else 'Vasen')+' olkavarsi','Vartalo','arm',(x,420),'root',lambda d,x=x:pill(d,(x-28,394,x+28,510),blue),joints=[(x,505)])
 layer(side+'Forearm',('Oikea' if side=='right' else 'Vasen')+' kyynärvarsi','Vartalo','arm',(x,505),side+'Arm',lambda d,x=x:pill(d,(x-24,485,x+24,590),light),joints=[(x,584)])
 layer(side+'Hand',('Oikea' if side=='right' else 'Vasen')+' kämmen','Vartalo','hand',(x,585),side+'Forearm',lambda d,x=x:d.ellipse((x-32,560,x+32,622),fill=orange,outline=dark,width=5))
def body(d):
 pill(d,(200,365,400,630),blue,48);pill(d,(243,432,357,530),dark,22);d.ellipse((276,449,324,497),fill=orange);d.line((245,573,355,573),fill=dark,width=8)
layer('root','Vartalo','Vartalo','body',(300,600),None,body)
def head(d):
 d.line((300,164,300,213),fill=dark,width=12);d.ellipse((284,141,316,173),fill=orange,outline=dark,width=4);pill(d,(159,205,441,391),blue,55);pill(d,(182,234,418,364),dark,35)
layer('head','Pää','Pää','head',(300,378),'root',head)
for side,x in [('right',245),('left',355)]:
 layer(side+'Eye',('Oikea' if side=='right' else 'Vasen')+' silmä','Pää','eye',(x,279),'head',lambda d,x=x:d.ellipse((x-30,252,x+30,310),fill=light))
 layer(side+'Pupil',('Oikea' if side=='right' else 'Vasen')+' pupilli','Pää','eye',(x,280),'head',lambda d,x=x:d.ellipse((x-12,268,x+12,292),fill=dark))
 layer(side+'Brow',('Oikea' if side=='right' else 'Vasen')+' kulmakarva','Pää','accessory',(x,243),'head',lambda d,x=x:d.line((x-25,239,x+25,239),fill=orange,width=9))
 layer(side+'Blink',('Oikea' if side=='right' else 'Vasen')+' räpäytys','Pää','eye',(x,280),'head',lambda d,x=x:(d.ellipse((x-31,251,x+31,311),fill=dark),d.line((x-24,280,x+24,280),fill=light,width=6)),True)
layer('mouthNeutral','Suu lepo','Suut','mouth',(300,331),'head',lambda d:d.rounded_rectangle((273,325,327,334),4,fill=light))
layer('mouthOpen','Suu auki','Suut','mouth',(300,332),'head',lambda d:(d.rounded_rectangle((271,315,329,349),15,fill=orange),d.rectangle((282,316,318,323),fill=light)),True)
layer('mouthRound','Suu pyöreä','Suut','mouth',(300,332),'head',lambda d:d.ellipse((282,313,318,351),fill=orange),True)
composite.save(out/'preview.png');(out/'composite.rgba').write_bytes(composite.tobytes());(out/'layers.json').write_text(json.dumps(layers,ensure_ascii=False))

# Separate, original portrait studio background; runtime reproduces this design at any supported scene size.
bg=Image.new('RGB',(1080,1920));brush=ImageDraw.Draw(bg)
for y in range(1920):
 t=y/1920;brush.line((0,y,1080,y),fill=tuple(round(a+(b-a)*t) for a,b in zip((23,43,67),(64,85,116))))
brush.rectangle((129,345,950,1536),fill=(96,115,146));brush.rectangle((0,1536,1080,1920),fill=(52,70,95));brush.line((129,345,950,345),fill=(129,146,172),width=3)
bg.save(Path(__file__).resolve().parent.parent/'public/library/Studio.png')
