"""Original flat paper-cutout cast, not characters or graphics from any TV show."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
import json
root=Path(__file__).resolve().parent.parent
for name,skin,coat,hair in [('Roni','#d5a17d','#226e74','#333136'),('Salla','#f0bb92','#ae4c3c','#643b30')]:
 for view in ['front','right','left']:
  out=root/'.paper-character-build'/name/view;out.mkdir(parents=True,exist_ok=True)
  layers=[];composite=Image.new('RGBA',(600,900));dark='#282b31';side=view!='front'
  def layer(key,label,group,role,pivot,parent,draw,hidden=False,joints=[]):
   im=Image.new('RGBA',(600,900));draw(ImageDraw.Draw(im))
   if view=='left':im=ImageOps.mirror(im);pivot=(600-pivot[0],pivot[1]);joints=[(600-x,y) for x,y in joints]
   box=im.getbbox()
   if not box:raise ValueError(key)
   crop=im.crop(box);crop.save(out/(key+'.png'));(out/(key+'.rgba')).write_bytes(crop.tobytes())
   layers.append(dict(key=key,name=label,group=group,role=role,pivot=dict(x=pivot[0],y=pivot[1]),parentKey=parent,joints=[dict(x=x,y=y) for x,y in joints],left=box[0],top=box[1],width=crop.width,height=crop.height,hidden=hidden))
   if not hidden:composite.alpha_composite(im)
  def shape(d,box,color,r=12):d.rounded_rectangle(box,r,fill=color,outline=dark,width=3)
  # Separate leg segments support stance IK; every view has its own joints.
  for which,x in [('right',280 if side else 254),('left',320 if side else 346)]:
   label='Oikea' if which=='right' else 'Vasen'
   layer(which+'Thigh',label+' reisi','Vartalo','leg',(x,600),'root',lambda d,x=x:shape(d,(x-24,580,x+24,703),'#3c4659'),joints=[(x,690)])
   layer(which+'Shin',label+' sääri','Vartalo','leg',(x,690),which+'Thigh',lambda d,x=x:shape(d,(x-22,672,x+22,791),'#3c4659'),joints=[(x,780)])
   layer(which+'Foot',label+' kenkä','Vartalo','foot',(x,780),which+'Shin',lambda d,x=x:shape(d,(x-30,769,x+42,804),'#282b31',8))
  for which,x in [('right',275 if side else 204),('left',325 if side else 396)]:
   label='Oikea' if which=='right' else 'Vasen'
   layer(which+'Arm',label+' olkavarsi','Vartalo','arm',(x,435),'root',lambda d,x=x:shape(d,(x-26,421,x+26,519),coat,20),joints=[(x,505)])
   layer(which+'Forearm',label+' kyynärvarsi','Vartalo','arm',(x,505),which+'Arm',lambda d,x=x:shape(d,(x-24,488,x+24,592),coat,18),joints=[(x,582)])
   layer(which+'Hand',label+' kämmen','Vartalo','hand',(x,582),which+'Forearm',lambda d,x=x:d.ellipse((x-28,565,x+28,612),fill=skin,outline=dark,width=3))
  def body(d):
   b=(245,407,355,635) if side else (208,404,392,635)
   shape(d,b,coat,26)
   d.line((300,416,300,627),fill='#f5dfab',width=4)
   for y in [460,506,552]:d.ellipse((305,y,312,y+7),fill=dark)
   if name=='Salla':d.polygon([(260,412),(300,448),(340,412)],fill='#f0dfcc')
  layer('root','Vartalo','Vartalo','body',(300,600),None,body)
  def head(d):
   shape(d,(277,375,323,441),skin,6)
   box=(181,149,416,418) if side else (151,139,449,421)
   d.ellipse(box,fill=skin,outline=dark,width=3)
   if side:
    d.polygon([(399,259),(432,286),(402,301)],fill=skin,outline=dark,width=3)
    d.ellipse((263,283,290,322),fill=skin,outline=dark,width=3)
   if name=='Roni':
    d.pieslice((box[0]-3,box[1]-5,box[2]+3,box[3]-20),180,357,fill=hair)
    d.polygon([(box[0]+10,230),(box[0]+20,177),(box[0]+72,157),(box[0]+60,132),(box[0]+123,156),(box[0]+158,128),(box[2]-28,172),(box[2]-5,233)],fill=hair)
   else:
    d.pieslice((box[0]-7,box[1]-8,box[2]+8,box[3]+12),165,375,fill=hair)
    d.polygon([(box[0]+4,227),(box[0]+42,167),(box[2]-28,187),(box[2]-5,229),(box[0]+95,200)],fill=hair)
    d.ellipse((box[0]-12,254,box[0]+32,410),fill=hair)
    d.line((box[0]+14,255,box[0]+39,247),fill='#e7bd59',width=8)
  layer('head','Pää','Pää','head',(300,424),'root',head)
  for which,x in [('right',367 if side else 247),('left',373 if side else 353)]:
   far=side and which=='right';label='Oikea' if which=='right' else 'Vasen'
   def face(draw):
    return (lambda d:d.point((190,270),fill=(0,0,0,1))) if far else draw
   layer(which+'Eye',label+' silmä','Pää','eye',(x,281),'head',face(lambda d,x=x:d.ellipse((x-33,246,x+33,309),fill='#fff9ed',outline=dark,width=2)))
   layer(which+'Pupil',label+' pupilli','Pää','eye',(x,284),'head',face(lambda d,x=x:d.ellipse((x-7,273,x+7,287),fill=dark)))
   layer(which+'Brow',label+' kulmakarva','Pää','accessory',(x,235),'head',face(lambda d,x=x:d.line((x-24,235,x+24,237),fill=hair,width=4)))
   layer(which+'Blink',label+' räpäytys','Pää','eye',(x,281),'head',face(lambda d,x=x:(d.ellipse((x-34,245,x+34,311),fill=skin),d.line((x-28,281,x+28,281),fill=dark,width=3))),True)
  mouth=380 if side else 300
  layer('mouthNeutral','Suu lepo','Suut','mouth',(mouth,353),'head',lambda d:d.line((mouth-20,353,mouth+20,353),fill=dark,width=3))
  layer('mouthOpen','Suu auki','Suut','mouth',(mouth,353),'head',lambda d:(d.ellipse((mouth-19,337,mouth+19,370),fill=dark),d.rectangle((mouth-13,340,mouth+13,347),fill='#fff9ed')),True)
  layer('mouthRound','Suu pyöreä','Suut','mouth',(mouth,353),'head',lambda d:d.ellipse((mouth-10,339,mouth+10,368),fill=dark),True)
  # Keep the near arm in front of the torso; the far arm stays behind it.
  if side:
   near=[n for n in layers if n['key'] in ['leftArm','leftForearm','leftHand']]
   layers=[n for n in layers if n not in near];at=next(i for i,n in enumerate(layers) if n['key']=='root')+1
   layers[at:at]=near
   composite=Image.new('RGBA',(600,900))
   for n in layers:
    if not n['hidden']:composite.alpha_composite(Image.open(out/(n['key']+'.png')),(n['left'],n['top']))
  composite.save(out/'preview.png');(out/'composite.rgba').write_bytes(composite.tobytes());(out/'layers.json').write_text(json.dumps(layers,ensure_ascii=False))
print('Roni and Salla: original paper-cutout artwork, 3 views each')
