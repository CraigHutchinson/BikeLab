import json,gzip,base64,hashlib,struct
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams['svg.hashsalt']='bikelab-equal-load'
p=Path('artifacts/equal-load');raw=(p/'report.json').read_bytes();r=json.loads(raw)
fig,axs=plt.subplots(2,2,figsize=(12,8),layout='constrained')
for a in r['runs']:
 if a['params']['dt']!=.00000390625:continue
 fs=a['frames'];ts=[f['time']*1000 for f in fs];label=f"{a['params']['nodes']} nodes, {a['params']['contactTime']*1000:g} ms contact"
 axs[0,0].plot(ts,[(f['hubZ']-fs[0]['hubZ'])*1e6 for f in fs],label=label)
 axs[0,1].plot(ts,[f['groundReaction']-400 for f in fs],label=label)
 axs[1,0].semilogy(ts[1:],[max(f['maxBodySpeed']*1000,1e-8) for f in fs[1:]],label=label)
 axs[1,1].plot(ts,[f['penetration']*1000 for f in fs],label=label)
axs[0,0].set(title='Equal 400 N load; finest tested timestep',xlabel='Time / ms',ylabel='Hub motion from initial / micrometres');axs[0,0].legend(fontsize=8)
axs[0,1].set(title='Ground reaction minus applied load',xlabel='Time / ms',ylabel='Reaction error / N');axs[0,1].axhline(5,color='black',ls=':',lw=.8);axs[0,1].axhline(-5,color='black',ls=':',lw=.8)
axs[1,0].set(title='Maximum native body translational speed',xlabel='Time / ms',ylabel='Speed / mm/s');axs[1,0].axhline(1,color='black',ls=':',label='Settling threshold')
axs[1,1].set(title='Native contact penetration',xlabel='Time / ms',ylabel='Penetration / mm')
for ax in axs.flat:ax.axvspan(80,100,color='grey',alpha=.1);ax.grid(alpha=.2)
fig.suptitle('Equal-load/contact refinement: shaded final window must independently qualify as settled')
fig.savefig(p/'equal-load.png',dpi=145);fig.savefig(p/'equal-load.svg',metadata={'Date':None});svg=p/'equal-load.svg';svg.write_bytes(('\n'.join(l.rstrip() for l in svg.read_text(encoding='utf-8').splitlines())+'\n').encode());Path('docs/evidence/equal-load.svg').write_bytes(svg.read_bytes())
r['completeLocalReportSha256']=hashlib.sha256(raw).hexdigest();r['archiveScope']='All scalar samples and all coordinate hashes; first/last recorded coordinates. Regenerate full history with the source-bound runner.'
for a in r['runs']:
 for index,f in enumerate(a['frames']):
  f['coordinatesSha256LE64']=hashlib.sha256(struct.pack('<'+'d'*len(f['coordinates']),*f['coordinates'])).hexdigest()
  if index not in [0,len(a['frames'])-1]:del f['coordinates']
Path('docs/evidence/equal-load.json.gz.b64').write_bytes(base64.b64encode(gzip.compress(json.dumps(r,separators=(',',':')).encode(),mtime=0))+b'\n')
