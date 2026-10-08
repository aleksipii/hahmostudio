"""Muokattava tyhjä hahmopohja (Hahmopohja). Alkuperäistä grafiikkaa; ei kopioitu mistään lähteestä."""
from PIL import Image, ImageDraw
from pathlib import Path
import json
root=Path(__file__).resolve().parent.parent
for name,asset,skin,shirt,hair,portrait,blank in [
 ('Hahmopohja','hahmostudio-blank-v1','#ffffff','#ffffff','#dbe3eb',False,True)]:
 height=700 if portrait else 900;out=root/'.character-build'/name;out.mkdir(parents=True,exist_ok=True);layers=[];composite=Image.new('RGBA',(600,height));dark='#24364b';eye='#ffffff'
 def layer(key,label,group,role,pivot,parent,draw,hidden=False,joints=[]):
  im=Image.new('RGBA',(600,height));draw(ImageDraw.Draw(im));box=im.getbbox()
  if not box:raise ValueError(key)
  crop=im.crop(box);crop.save(out/(key+'.png'));(out/(key+'.rgba')).write_bytes(crop.tobytes());layers.append(dict(key=key,name=label,group=group,role=role,pivot=dict(x=pivot[0],y=pivot[1]),parentKey=parent,joints=[dict(x=x,y=y) for x,y in joints],left=box[0],top=box[1],width=crop.width,height=crop.height,hidden=hidden))
  if not hidden:composite.alpha_composite(im)
 def pill(d,b,color,r=20):d.rounded_rectangle(b,r,fill=color,outline=dark,width=5)
 if not portrait:
  for side,x in [('right',252),('left',348)]:
   label='Oikea' if side=='right' else 'Vasen'
   layer(side+'Thigh',label+' reisi','Vartalo','leg',(x,600),'root',lambda d,x=x:pill(d,(x-29,577,x+29,704),'#f6f8fa' if blank else '#354e70'),joints=[(x,690)])
   layer(side+'Shin',label+' sääri','Vartalo','leg',(x,690),side+'Thigh',lambda d,x=x:pill(d,(x-26,670,x+26,790),'#f6f8fa' if blank else '#354e70'),joints=[(x,780)])
   layer(side+'Foot',label+' jalkaterä','Vartalo','foot',(x,780),side+'Shin',lambda d,x=x:pill(d,(x-35,762,x+43,810),'#dbe3eb' if blank else '#d3e2ea',14))
 for side,x in [('right',194),('left',406)]:
  label='Oikea' if side=='right' else 'Vasen'
  layer(side+'Arm',label+' olkavarsi','Vartalo','arm',(x,421),'root',lambda d,x=x:pill(d,(x-30,395,x+30,515),shirt),joints=[(x,505)])
  layer(side+'Forearm',label+' kyynärvarsi','Vartalo','arm',(x,505),side+'Arm',lambda d,x=x:pill(d,(x-23,484,x+23,590),skin),joints=[(x,582)])
  layer(side+'Hand',label+' kämmen','Vartalo','hand',(x,582),side+'Forearm',lambda d,x=x:d.ellipse((x-29,559,x+29,618),fill=skin,outline=dark,width=5))
 def body(d):
  pill(d,(207,360,393,630),shirt,40);d.line((244,607,356,607),fill=dark,width=5)
  if not blank:d.line((282,386,300,401,318,386),fill='#eee9f9',width=5)
 layer('root','Vartalo','Vartalo','body',(300,600),None,body)
 def head(d):
  pill(d,(275,323,325,401),skin,14);d.ellipse((163,183,437,365),fill=skin,outline=dark,width=5)
  if not blank:
   d.pieslice((160,161,440,302),180,356,fill=hair);d.polygon([(164,231),(185,195),(215,216),(235,195),(287,218),(325,195),(378,216),(434,230),(417,178),(194,176)],fill=hair)
   d.arc((293,274,313,308),0,115,fill=dark,width=3)
 layer('head','Pää','Pää','head',(300,378),'root',head)
 for side,x in [('right',246),('left',354)]:
  label='Oikea' if side=='right' else 'Vasen'
  layer(side+'Eye',label+' silmä','Pää','eye',(x,272),'head',lambda d,x=x:d.ellipse((x-29,247,x+29,298),fill=eye,outline=dark,width=3))
  layer(side+'Pupil',label+' pupilli','Pää','eye',(x,274),'head',lambda d,x=x:d.ellipse((x-11,262,x+11,285),fill=dark))
  layer(side+'Brow',label+' kulmakarva','Pää','accessory',(x,238),'head',lambda d,x=x:d.line((x-24,234,x+24,234),fill=dark,width=7))
  layer(side+'Blink',label+' räpäytys','Pää','eye',(x,272),'head',lambda d,x=x:(d.ellipse((x-31,245,x+31,300),fill=skin),d.line((x-24,272,x+24,272),fill=dark,width=5)),True)
 layer('mouthNeutral','Suu lepo','Suut','mouth',(300,327),'head',lambda d:d.arc((275,307,325,335),0,180,fill=dark,width=5))
 layer('mouthOpen','Suu auki','Suut','mouth',(300,327),'head',lambda d:(d.rounded_rectangle((275,309,325,345),12,fill=dark),d.rectangle((284,310,316,318),fill=eye)),True)
 layer('mouthRound','Suu pyöreä','Suut','mouth',(300,327),'head',lambda d:d.ellipse((285,308,315,346),fill=dark),True)
 composite.save(out/'preview.png');(out/'composite.rgba').write_bytes(composite.tobytes());(out/'layers.json').write_text(json.dumps(layers,ensure_ascii=False));(out/'character.json').write_text(json.dumps(dict(name=name,asset=asset,width=600,height=height,portrait=portrait)))
