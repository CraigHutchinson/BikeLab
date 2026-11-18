import json,gzip,base64,hashlib,struct
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams['svg.hashsalt']='bikelab-native-loaded'
e=json.loads(Path('artifacts/native-loaded/report.json').read_bytes())
i=json.loads(Path('artifacts/native-loaded/implicit-report.json').read_bytes())
fig,axs=plt.subplots(2,2,figsize=(12,8),layout='constrained')
for group,(report,name) in enumerate([(e,'Euler'),(i,'implicitfast')]):
 for index,dt in enumerate([.000015625,.0000078125,.00000390625]):
  color=plt.rcParams['axes.prop_cycle'].by_key()['color'][group*3+index]
  r=next(r for r in report['runs'] if r['params']['nodes']==512 and r['params']['tyreMass']==.5 and r['params']['edgeViscosity']==.5 and r['params']['dt']==dt)
  fs=r['frames'];ts=[f['time']*1000 for f in fs];label=f'{name}, {dt*1e6:g} us'
  if r['status']!='completed':label+=' (terminated)'
  axs[0,0].plot(ts,[(f['hubZ']-fs[0]['hubZ'])*1e6 for f in fs],label=label,color=color,marker='x' if len(fs)==1 else None)
  if len(fs)>1:axs[0,1].plot(ts,[f['residual']*1000 for f in fs],label=label,color=color)
axs[0,0].set(title='512 stations, half mass, damping on',xlabel='Time / ms',ylabel='Hub movement from initial / micrometres')
axs[0,0].legend(fontsize=7)
axs[0,1].legend(fontsize=7)
axs[0,1].set(title='Completed trajectories only; failed maxima in receipt',xlabel='Time / ms',ylabel='Energy/work residual / mJ')
for n in [256,512]:
 r=next(r for r in i['runs'] if r['params']['nodes']==n and r['params']['tyreMass']==1 and r['params']['edgeViscosity']==.5 and r['params']['dt']==.00000390625)
 fs=r['frames'];axs[1,0].plot([f['time']*1000 for f in fs],[(f['hubZ']-fs[0]['hubZ'])*1e6 for f in fs],label=f'{n} stations')
 f=fs[-1];q=f['coordinates'];axs[1,1].plot(q[::2]+[q[0]],[z+f['hubZ']-.008 for z in q[1::2]]+[q[1]+f['hubZ']-.008],label=f'{n} final centreline - skin')
axs[1,0].set(title='Native mesh discrepancy remains: nominal mass',xlabel='Time / ms',ylabel='Hub movement from initial / micrometres');axs[1,0].legend()
axs[1,1].set(title='Final lower contact region (implicitfast)',xlabel='Horizontal position / m',ylabel='Centreline minus skin / m',xlim=(-.06,.06),ylim=(-.0005,.007));axs[1,1].axhline(0,color='black',lw=.8);axs[1,1].legend()
for ax in axs.flat:ax.grid(alpha=.2)
fig.suptitle('Native loaded diagnostic: integrator receiving is separate from mesh admission')
p=Path('artifacts/native-loaded');fig.savefig(p/'loaded.png',dpi=145);fig.savefig(p/'loaded.svg',metadata={'Date':None});s=p/'loaded.svg';s.write_bytes(('\n'.join(l.rstrip() for l in s.read_text(encoding='utf-8').splitlines())+'\n').encode());Path('docs/evidence/native-loaded.svg').write_bytes(s.read_bytes())
r=i;r['metadataCorrections']='params.gravity corrected from inherited DEFAULTS 9.80665 to actual XML gravity 0. No trajectory values changed. Original full local report hash retained.';r['completeLocalReportSha256']=hashlib.sha256((p/'implicit-report.json').read_bytes()).hexdigest()
for run in r['runs']:
 run['params']['gravity']=0
 for index,f in enumerate(run['frames']):
  f['coordinatesSha256LE64']=hashlib.sha256(struct.pack('<'+'d'*len(f['coordinates']),*f['coordinates'])).hexdigest()
  if index not in [0,len(run['frames'])-1]:del f['coordinates']
r['archiveScope']='Every scalar observation and coordinate hash; first/last recorded coordinates. Full coordinate history is reproducible via source-bound sweep.'
Path('docs/evidence/native-loaded-implicit.json.gz.b64').write_bytes(base64.b64encode(gzip.compress(json.dumps(r,separators=(',',':')).encode(),mtime=0))+b'\n')
