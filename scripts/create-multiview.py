"""Three separately drawn views with common semantic joints; left mirrors the side drawing."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
import json
root=Path(__file__).resolve().parent.parent
source=(root/'scripts/create-characters.py').read_text()
# Share existing human drawing pipeline without altering the original library.
start=source.index(' height=700');body=source[start:]
body='\n'.join(line[1:] if line.startswith(' ') else line for line in body.splitlines())
for view in ['front','right','left']:
 code=body.replace("out=root/'.character-build'/name", "out=root/'.multiview-build'/view")
 if view!='front':
  code=code.replace("[('right',252),('left',348)]", "[('right',282),('left',318)]").replace("[('right',194),('left',406)]", "[('right',282),('left',318)]")
  code=code.replace('(207,360,393,630)','(247,360,353,630)').replace('(244,607,356,607)','(265,607,335,607)').replace('(282,386,300,401,318,386)','(287,385,320,401,337,386)')
  a=code.index('def head(d):');b=code.index("layer('head'",a)
  code=code[:a]+'''def head(d):
 pill(d,(278,325,322,401),skin,14)
 d.ellipse((201,183,389,365),fill=skin,outline=dark,width=5)
 d.polygon([(359,248),(390,265),(418,284),(386,292),(375,325),(350,348)],fill=skin,outline=dark,width=4)
 d.pieslice((197,164,391,323),95,350,fill=hair)
 d.ellipse((260,266,290,304),fill=skin,outline=dark,width=3)
''' +code[b:]
  code=code.replace("[('right',246),('left',354)]", "[('right',351),('left',357)]")
  code=code.replace('(x-29,247,x+29,298)','(x-17,253,x+17,292)').replace('(x-11,262,x+11,285)','(x-7,265,x+7,281)').replace('(x-24,234,x+24,234)','(x-17,240,x+17,240)').replace('(x-31,245,x+31,300)','(x-18,251,x+18,294)').replace('(x-24,272,x+24,272)','(x-13,272,x+13,272)')
  code=code.replace('(275,307,325,335)','(354,312,393,338)').replace('(275,309,325,345)','(357,312,390,344)').replace('(284,310,316,318)','(361,315,384,321)').replace('(285,308,315,346)','(365,312,390,346)')
  code=code.replace('(300,327)', '(376,327)')
  # Hide the far eye geometrically; its retained role still makes the controller portable.
  code=code.replace('crop=im.crop(box);', "\n if view in ['right','left'] and key.startswith('right') and role in ['eye','accessory']:im=Image.new('RGBA',(600,height));im.putpixel((box[0],box[1]),(0,0,0,1))\n crop=im.crop(box);")
 if view=='left':
  code=code.replace('draw(ImageDraw.Draw(im));box=im.getbbox()', 'draw(ImageDraw.Draw(im));im=ImageOps.mirror(im);pivot=(600-pivot[0],pivot[1]);joints=[(600-x,y) for x,y in joints];box=im.getbbox()')
 ns=dict(root=root,name='Aino-Monikulma',asset='hahmostudio-aino-multiview-v1',skin='#b97957',shirt='#8b60c9',hair='#352b36',portrait=False,blank=False,view=view,Image=Image,ImageDraw=ImageDraw,ImageOps=ImageOps,Path=Path,json=json)
 exec(code,ns)
