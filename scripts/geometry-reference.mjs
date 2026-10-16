// Optional review-only downloads. Never loaded by the site or used as model parameters.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='artifacts/browser/geometry-reference';await mkdir(dir,{recursive:true});
const sources=[
  {name:'orange-five-2020.jpg',page:'https://orangebikes.com/blogs/bike-archive-2020/five-factory-2020',url:'https://orangebikes.com/cdn/shop/articles/2020_Orange_Five-Factory_Fizzy.jpg?v=1765881897'},
  {name:'orange-crush-2023.jpg',page:'https://www.tredz.co.uk/.Orange-Crush-Comp-27-5-Mountain-Bike-2023-Hardtail-MTB_250279.htm',url:'https://tredz.azureedge.net/prodimg/250279-857858_1_Supersize.jpg'}
];
for(const source of sources){const response=await fetch(source.url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`${source.name}: ${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());await writeFile(`${dir}/${source.name}`,bytes);source.sha256=createHash('sha256').update(bytes).digest('hex');source.bytes=bytes.length;}
await writeFile(`${dir}/sources.json`,JSON.stringify(sources,null,2)+'\n');
