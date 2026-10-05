"""JSON Schema for the public deterministic interchange formats."""
import json
from pathlib import Path
vis=['REST','AI','E','O','U','MBP','FV','CDGKNRSThYZ','L_WQ']
num={'type':'number'}; frame={'type':'integer','minimum':0,'maximum':28800}
def vec(n):return {'type':'array','items':num,'minItems':n,'maxItems':n}
def obj(properties,required):return {'type':'object','properties':properties,'required':required,'additionalProperties':False}
layer=obj({'id':{'type':'string','pattern':'^[A-Za-z0-9_]{1,100}$'},'parent':{'type':'string'},'pivot':{'type':'array','items':{'type':'number','minimum':0,'maximum':1},'minItems':2,'maxItems':2},'bounds':vec(4),'pivotFrame':vec(4),'z':num,'switch':{'type':'string'},'state':{'type':'string'},'default':{'type':'boolean'}},['id','pivot','bounds','z'])
rig=obj({'version':{'const':1},'width':{'type':'integer','minimum':1,'maximum':4096},'height':{'type':'integer','minimum':1,'maximum':4096},'layers':{'type':'array','items':layer,'minItems':1,'maxItems':200}},['version','width','height','layers'])
actor=obj({'id':{'type':'string','maxLength':100},'asset':{'enum':['Kille','Mr.Kille','Mr.Handu']},'x':num,'y':num,'scale':{'type':'number','exclusiveMinimum':0,'maximum':10},'rig':rig},['id','asset','x','y','scale','rig'])
event=obj({'id':{'type':'string','maxLength':100},'kind':{'enum':['scene','dialogue','action','emotion','camera','hold']},'actor':{'type':'string','maxLength':100},'value':{'type':'string','maxLength':5000},'line':{'type':'integer','minimum':1},'seconds':{'type':'number','exclusiveMinimum':0,'maximum':60},'start':frame,'end':frame},['id','kind','value','line','start','end'])
timeline=obj({'format':{'const':'kilsat-cutout'},'version':{'const':1},'fps':{'const':24},'source':{'type':'string','maxLength':60000},'duration':{'type':'integer','minimum':1,'maximum':28800},'width':{'type':'integer','minimum':1,'maximum':4096},'height':{'type':'integer','minimum':1,'maximum':4096},'cadence':{'enum':['twos','threes','three-two']},'actors':{'type':'array','items':actor,'minItems':1,'maxItems':4},'events':{'type':'array','items':event,'maxItems':2500}},['format','version','fps','source','duration','width','height','cadence','actors','events'])
stateLayer=obj({'id':{'type':'string'},'opacity':{'enum':[0,1]},'matrix':vec(6)},['id','opacity','matrix'])
stateActor=obj({'id':{'type':'string'},'asset':{'enum':['Kille','Mr.Kille','Mr.Handu']},'switches':obj({'EYES_GROUP':{'enum':['NORMAL','BLINK','SQUINT','ANGRY']},'MOUTH_SWITCH':{'enum':vis},'ARM_LEFT_HAND':{'enum':['DEFAULT','POINT','FIST']},'ARM_RIGHT_HAND':{'enum':['DEFAULT','POINT','FIST']}},['EYES_GROUP','MOUTH_SWITCH','ARM_LEFT_HAND','ARM_RIGHT_HAND']),'layers':{'type':'array','items':stateLayer,'maxItems':200}},['id','asset','switches','layers'])
state=obj({'format':{'const':'kilsat-cutout-frame'},'version':{'const':1},'frame':frame,'fps':{'const':24},'width':{'type':'integer'},'height':{'type':'integer'},'scene':{'enum':['WHITE_STUDIO','STUDIO','STREET','CAR']},'camera':vec(6),'actors':{'type':'array','items':stateActor,'minItems':1,'maxItems':4}},['format','version','frame','fps','width','height','scene','camera','actors'])
schemas={'timeline':timeline,'animation-package':obj({'timeline':timeline,'voices':{'type':'object','additionalProperties':{'type':'array','items':{'enum':vis},'maxItems':28800}}},['timeline','voices']),'frames':obj({'timeline':timeline,'frames':{'type':'array','items':state,'minItems':1,'maxItems':7200}},['timeline','frames']),'rig':rig}
out=Path(__file__).resolve().parent.parent/'public/schemas';out.mkdir(exist_ok=True)
for name,schema in schemas.items():
 schema={'$schema':'https://json-schema.org/draft/2020-12/schema', 'title':'KILSAT cutout '+name,**schema}
 (out/('cutout-'+name+'.schema.json')).write_text(json.dumps(schema,indent=2)+'\n')
