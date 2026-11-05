"""Plot saved spatial force residuals; never solve or modify the state."""
import json
import math
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
source=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/tyre-meridian/report.json')
r=json.loads(source.read_text()); assert r['model']=='bikelab-meridian-energy-0.1'
plt.rcParams['svg.hashsalt']=r['model']
fig,axes=plt.subplots(1,2,figsize=(11,4.5),layout='constrained')
c=r['cases'][1]; points=c['points']; forces=c['state']['forces']; scale=15000
axes[0].plot([p[0]*1000 for p in points],[p[1]*1000 for p in points],'.-',label='Circular-family stationary shape')
axes[0].quiver([p[0]*1000 for p in points[1:-1]],[p[1]*1000 for p in points[1:-1]],[f[0]*1000 for f in forces[1:-1]],[f[1]*1000 for f in forces[1:-1]],angles='xy',scale_units='xy',scale=scale,color='#b65525')
axes[0].set(xlabel='Axial x (mm)',ylabel='Radial height above rim (mm)',title='32 segments: free-node residual forces',xlim=(-40,40),ylim=(-10,65));axes[0].set_aspect('equal')
axes[0].text(.03,.96,'Free-node arrows: 150 N = 10 mm',va='top',transform=axes[0].transAxes,fontsize=9)
for c in r['cases']:
    s=c['state']; rest=c['configuration']['restPoints']; L=c['configuration']['rimRadius']
    areas=[2*math.pi*(L+(a[1]+b[1])/2)*math.hypot(b[0]-a[0],b[1]-a[1]) for a,b in zip(rest,rest[1:])]
    values=[math.hypot(*f)/((areas[i]+areas[i+1])/2)/1000 for i,f in enumerate(s['forces'][1:-1])]
    axes[1].plot([i/c['segments'] for i in range(1,c['segments'])],values,label=f"{c['segments']} segments")
axes[1].set(xlabel='Material meridian fraction',ylabel='Residual / reference area (kPa)',title='Nonzero residual despite scalar stationarity');axes[1].legend();axes[1].grid(alpha=.2)
fig.suptitle('Illustrative biaxial membrane · not an equilibrium or calibrated tyre',fontsize=12)
fig.savefig(source.parent/'meridian.png',dpi=160)
svg=source.parent/'meridian.svg';fig.savefig(svg,metadata={'Date':None});svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
