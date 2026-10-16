import {CATALOGUE,referenceRows} from './geometry-catalogue.js';
const $=id=>document.getElementById(id),select=$('manufacturerReference');
for(const r of CATALOGUE.records)select.add(new Option(`${r.brand} ${r.model} · ${r.year} · ${r.size} · ${r.configuration}`,r.id));
function showReference(){
  const r=CATALOGUE.records.find(r=>r.id===select.value),body=$('referenceDimensions');body.replaceChildren();
  $('referenceDescription').textContent=`${r.topology}. ${r.notes.join(' ')}`;
  for(const row of referenceRows(r)){
    const tr=document.createElement('tr'),name=document.createElement('th'),value=document.createElement('td');name.scope='row';name.textContent=row.label;value.textContent=row.display+(row.value===null?'':' '+row.unit);tr.append(name,value);body.append(tr);
  }
  $('referenceSources').replaceChildren();
  for(const id of r.sourceIds){const source=CATALOGUE.sources.find(s=>s.id===id),p=document.createElement('p'),a=document.createElement('a');a.href=source.url;a.textContent=source.title;a.target='_blank';a.rel='noopener noreferrer';p.append(a,` · ${source.section} · reviewed ${source.reviewed}`);$('referenceSources').append(p);}
  $('referenceReadiness').textContent='Reference only: numerical pivot and shock-eye coordinates are not supplied by these sources. This selection does not change the calculated bike. A production simulation preset also needs supported topology and measured mass/inertia data.';
}
select.addEventListener('change',showReference);showReference();
$('exportCatalogue').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(CATALOGUE,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='bikelab-geometry-catalogue.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
