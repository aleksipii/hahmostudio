from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
import json
root=Path(__file__).resolve().parent.parent
source=(root/'scripts/create-otto.py').read_text().split('# Separate, original portrait')[0]
for view in ['front','right','left']:
 code=source.replace('out.mkdir(exist_ok=True)','out.mkdir(parents=True,exist_ok=True)').replace("out=Path(__file__).resolve().parent.parent / '.asset-build'", "out=root/'.multiview-otto-build'/view")
 if view!='front':
  code=code.replace("[('right',245),('left',355)]", "[('right',282),('left',318)]",1).replace("[('right',191),('left',409)]", "[('right',282),('left',318)]",1)
  code=code.replace('(200,365,400,630)','(247,365,353,630)').replace('(243,432,357,530)','(263,432,337,530)').replace('(245,573,355,573)','(267,573,333,573)')
  code=code.replace('(159,205,441,391)','(195,205,421,391)').replace('(182,234,418,364)','(350,234,413,364)')
  code=code.replace("[('right',245),('left',355)]", "[('right',379),('left',389)]")
  # The second eye is drawn smaller; the far side is almost transparent below.
  code=code.replace('(x-30,252,x+30,310)','(x-13,252,x+13,310)').replace('(x-12,268,x+12,292)','(x-7,268,x+7,292)').replace('(x-25,239,x+25,239)','(x-11,239,x+11,239)')
  code=code.replace('(273,325,327,334)','(365,325,402,334)').replace('(271,315,329,349)','(365,315,402,349)').replace('(282,316,318,323)','(370,316,397,323)').replace('(282,313,318,351)','(369,313,399,351)').replace('(300,331)','(384,331)').replace('(300,332)','(384,332)')
  code=code.replace('crop=im.crop(box);', "\n if key.startswith('right') and role in ['eye','accessory']:im=Image.new('RGBA',(600,900));im.putpixel((box[0],box[1]),(0,0,0,1))\n crop=im.crop(box);")
 if view=='left':code=code.replace('draw(d);box=im.getbbox()', 'draw(d);im=ImageOps.mirror(im);pivot=(600-pivot[0],pivot[1]);joints=[(600-x,y) for x,y in joints];box=im.getbbox()')
 exec(code,dict(root=root,view=view,Image=Image,ImageDraw=ImageDraw,ImageOps=ImageOps,Path=Path,json=json,__file__=str(root/'scripts/create-otto.py')))
