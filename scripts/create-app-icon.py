"""Build macOS PNG-backed ICNS representations from the supplied original logo."""
from pathlib import Path
from io import BytesIO
import struct
from PIL import Image
root=Path(__file__).resolve().parent.parent
source=Image.open(root/'public/branding/kilsat-studio.png').convert('RGBA')
representations=[(b'icp4',16),(b'icp5',32),(b'icp6',64),(b'ic07',128),(b'ic08',256),(b'ic09',512),(b'ic10',1024),(b'ic11',32),(b'ic12',64),(b'ic13',256),(b'ic14',512)]
chunks=[]
for kind,size in representations:
 data=BytesIO();source.resize((size,size),Image.Resampling.LANCZOS).save(data,format='PNG');payload=data.getvalue();chunks.append(kind+struct.pack('>I',len(payload)+8)+payload)
body=b''.join(chunks)
(root/'desktop/assets/Hahmostudio.icns').write_bytes(b'icns'+struct.pack('>I',len(body)+8)+body)
source.resize((64,64),Image.Resampling.LANCZOS).save(root/'public/favicon.png')
print('KILSAT Studio ICNS: 11 original-logo representations, 16–1024 px')
