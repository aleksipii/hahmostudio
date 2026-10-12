import subprocess,numpy as np,sys
mp4=sys.argv[1];W,H=1080,1920
raw=subprocess.run(['ffmpeg','-v','error','-i',mp4,'-vf','crop=140:100:230:1405','-f','rawvideo','-pix_fmt','rgb24','-'],capture_output=True).stdout
fr=np.frombuffer(raw,np.uint8).reshape(-1,100,140,3).astype(float)
# suun tumma sisus: tummat punertavat pikselit
dark=((fr.sum(-1)<330)&(fr[...,0]>fr[...,2])).sum((1,2))
a=np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',mp4,'-vn','-ac','1','-ar','48000','-f','f32le','-'],capture_output=True).stdout,np.float32)
n=len(fr);rms=np.array([np.sqrt(np.mean(a[i*1600:(i+1)*1600]**2)) if i*1600<len(a) else 0 for i in range(n)])
print('frames',n,'mouth px min/max',dark.min(),dark.max())
def c(x,y):x=x-x.mean();y=y-y.mean();return float((x*y).sum()/np.sqrt((x*x).sum()*(y*y).sum()))
for lag in range(-6,7):
    x=dark[max(0,lag):n+min(0,lag)];y=rms[max(0,-lag):n-max(0,lag)]
    print('lag',lag,'frames corr',round(c(x,y),3))
silent=[i for i in range(n) if rms[i]<0.003];loud=[i for i in range(n) if rms[i]>np.percentile(rms,80)]
print('silent frames mouth px mean',dark[silent].mean() if silent else None,'loud',dark[loud].mean())

