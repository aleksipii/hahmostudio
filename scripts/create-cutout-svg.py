"""Original, deterministic cut-paper cast. No generated images or external character assets."""
import json
from pathlib import Path
out=Path(__file__).resolve().parent.parent/'public/library/cutout'
out.mkdir(parents=True,exist_ok=True)
for name,color,hat,skin in [('Mr.Kille','#328e9f','#29465d','#efc39d'),('Mr.Handu','#c36b43','#514840','#e6b187')]:
 layers=[];art={}
 def add(id,parent,bounds,pivot,z,shape='',switch=None,state=None,default=False):
  layer=dict(id=id,pivot=pivot,bounds=bounds,z=z)
  if parent:layer['parent']=parent
  if switch:layer.update(switch=switch,state=state,default=default)
  layers.append(layer);art[id]=shape
 add('ROOT',None,[0,0,400,600],[0,0],0)
 add('PANTS','TORSO',[120,410,160,70],[.5,0],1,'<path d="M120 410h160v70h-65v-20h-30v20h-65z" fill="#34485b"/>')
 layers[-1]['pivotFrame']=[120,445,160,70]
 for side,x,p in [('LEFT',125,.35),('RIGHT',225,.65)]:
  add('LEG_'+side,'PANTS',[x,445,50,135],[p,.90],1,f'<path d="M{x} 445v110h50V445" fill="#34485b"/><path d="M{x-12} 555q5-13 22-13h40q16 4 18 26v12h-80z" fill="#24323d"/>')
  layers[-1]['pivotFrame']=[x+25-50*p,445-135*.90,50,135]
 add('TORSO','ROOT',[110,245,180,195],[.5,.2],2,f'<rect x="110" y="245" width="180" height="195" rx="8" fill="{color}"/><path d="M200 266v160" fill="none" stroke="#173441"/><path d="M115 407h170v24H115z" fill="{color}"/>'+''.join(f'<circle cx="210" cy="{y}" r="3" fill="#f0d3a2" stroke="none"/>' for y in [295,325,355,385])+'<path d="M124 355h47v25h-47z" fill="none"/>')
 layers[-1]['pivotFrame']=[110,430-195*.2,180,195]
 for side,x,p in [('LEFT',90,.15),('RIGHT',270,.85)]:
  add('ARM_'+side+'_UPPER','TORSO',[x,270,40,150],[p,.85],3,f'<rect x="{x}" y="270" width="40" height="148" rx="20" fill="{color}"/><path d="M{x+2} 400h36v16h-36z" fill="{hat}"/>')
  layers[-1]['pivotFrame']=[x+20-40*p,290-150*.85,40,150]
  add('ARM_'+side+'_HAND','ARM_'+side+'_UPPER',[x,395,40,45],[.5,0],4)
  for state in ['DEFAULT','POINT','FIST']:
   # Pointing uses the whole mitten silhouette; no individual fingers.
   shape=f'<path d="M{x+4} 435q-18-18 0-32q7-11 20-2q20-3 21 15q-1 22-22 24z" fill="{skin}"/>'
   if state=='POINT':shape=f'<path d="M{x-3} 432v-29q0-16 18-16l40 9v19l-29 2v15z" fill="{skin}"/>'
   if state=='FIST':shape=f'<rect x="{x-3}" y="400" width="46" height="40" rx="14" fill="{skin}"/>'
   add('HAND_'+side+'_'+state,'ARM_'+side+'_HAND',[x,395,40,45],[.5,0],4,shape,'ARM_'+side+'_HAND',state,state=='DEFAULT')
 add('HEAD_GROUP','TORSO',[90,30,220,220],[.5,.05],5,f'<circle cx="200" cy="140" r="110" fill="{skin}"/>')
 layers[-1]['pivotFrame']=[90,244-220*.05,220,220]
 hair=f'<path d="M92 101q-9-71 107-76q115-4 109 76l-29-25l-19 6l-34-21l-35 13l-30-8l-29 27z" fill="{hat}"/>' if name=='Mr.Handu' else f'<path d="M91 103q-3-78 109-78q112 0 109 78z" fill="{hat}"/><path d="M90 88h220v23H90z" fill="#46728a"/>'+''.join(f'<path d="M{x} 90v19" stroke="#29465d" fill="none"/>' for x in range(102,303,12))
 add('HAT_TOP','HEAD_GROUP',[85,25,230,88],[.5,.5],6,hair)
 add('FACE_DETAILS','HEAD_GROUP',[130,165,140,64],[.5,.5],6,'<path d="M193 163l-5 12q12 6 24-1" fill="none" stroke="#b07859"/>'+('<path d="M170 182q15-13 30-1q15-12 30 1l-5 9h-50z" fill="#514840"/>' if name=='Mr.Handu' else ''))
 add('EYES_GROUP','HEAD_GROUP',[130,113,140,57],[.5,.5],7)
 for state in ['NORMAL','BLINK','SQUINT','ANGRY']:
  eyes=''.join(f'<ellipse cx="{x}" cy="140" rx="25" ry="28" fill="#fffdf5"/>' for x in [155,245])
  if state=='BLINK':eyes='<path d="M130 141h50m40 0h50" fill="none"/>'
  elif state=='SQUINT':eyes=''.join(f'<path d="M{x-25} 144q25 8 50 0v-10h-50z" fill="#fffdf5"/>' for x in [155,245])
  elif state=='ANGRY':eyes+='<path d="M128 114l53 13m38 0l53-13" fill="none" stroke-width="6"/>'
  add('EYES_'+state,'EYES_GROUP',[130,113,140,57],[.5,.5],7,eyes,'EYES_GROUP',state,state=='NORMAL')
 # Independent controller parts keep the current camera and quick animation compatible.
 for side,x in [('LEFT',155),('RIGHT',245)]:
  add('PUPIL_'+side,'HEAD_GROUP',[x-7,132,14,16],[.5,.5],8,f'<ellipse cx="{x}" cy="140" rx="6" ry="7" fill="black" stroke="none"/>','PUPILS','VISIBLE',True)
  add('BROW_'+side,'HEAD_GROUP',[x-23,106,46,8],[.5,.5],8,f'<path d="M{x-23} 110h46" stroke="{hat}" stroke-width="5" fill="none"/>')
  add('LID_'+side,'HEAD_GROUP',[x-29,108,58,64],[.5,.5],9,f'<ellipse cx="{x}" cy="140" rx="29" ry="32" fill="{skin}" stroke="none"/><path d="M{x-25} 141h50" fill="none"/>','MANUAL_LIDS','OFF',False)
 add('MOUTH_SWITCH','HEAD_GROUP',[170,188,60,42],[.5,.5],10)
 for state in ['REST','AI','E','O','U','MBP','FV','CDGKNRSThYZ','L_WQ']:
  ry={'AI':20,'E':11,'O':19,'U':14,'FV':7,'CDGKNRSThYZ':10,'L_WQ':17}.get(state,0)
  mouth='<path d="M177 207h46" fill="none"/>' if not ry else f'<ellipse cx="200" cy="207" rx="{14 if state in ["O","U"] else 27}" ry="{ry}" fill="#302329"/>'
  if state in ['E','FV','CDGKNRSThYZ']:mouth+='<path d="M179 201h42v6h-42z" fill="#fffdf5" stroke="none"/>'
  if state in ['AI','L_WQ']:mouth+='<path d="M188 220q12-16 24 0z" fill="#d47c7b" stroke="none"/>'
  if state=='MBP':mouth='<path d="M177 204q23 9 46 0m-46 4q23 9 46 0" fill="none"/>'
  add('MOUTH_'+state,'MOUTH_SWITCH',[170,188,60,42],[.5,.5],10,mouth,'MOUTH_SWITCH',state,state=='REST')
 rig=dict(version=1,width=400,height=600,layers=layers)
 children={l['id']:[] for l in layers}
 for l in layers:
  if l.get('parent'):children[l['parent']].append(l['id'])
 def group(id):
  l=next(l for l in layers if l['id']==id)
  attrs=f'id="{id}" data-pivot-x="{l["pivot"][0]}" data-pivot-y="{l["pivot"][1]}"'
  if l.get('pivotFrame'):attrs+=' data-pivot-frame="'+' '.join(str(n) for n in l['pivotFrame'])+'"'
  if l.get('parent'):attrs+=f' data-parent="{l["parent"]}"'
  if l.get('switch'):attrs+=f' data-switch="{l["switch"]}" data-state="{l["state"]}"'+(' style="display:none"' if not l['default'] else '')
  content=('<g filter="url(#paper)">'+art[id]+'</g>') if art[id] else ''
  return f'<g {attrs}>'+content+''.join(group(c) for c in sorted(children[id],key=lambda c:next(l['z'] for l in layers if l['id']==c)))+'</g>'
 defs='<defs><filter id="paper" filterUnits="userSpaceOnUse" x="-200" y="-200" width="800" height="1000"><feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-opacity="0.25"/></filter></defs>'
 svg='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600" role="img" aria-label="'+name+'">'+defs+'<g stroke="#000" stroke-width="3" stroke-linejoin="round">'+group('ROOT')+'</g></svg>'
 (out/(name+'.svg')).write_text(svg)
 (out/(name+'.rig.json')).write_text(json.dumps(rig,indent=2))
 (out/(name+'.art.json')).write_text(json.dumps(dict(format='kilsat-cutout-art',version=1,width=400,height=600,layers=art),indent=2))
 print(name,len(layers),'original layers')
