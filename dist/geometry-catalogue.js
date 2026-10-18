// Manufacturer nominal dimensions. SI internally; unknown mechanism data stays null.
// These reference records are not parameter sets for the current synthetic rig.
const radians=degrees=>degrees*Math.PI/180;
const orangeSource={id:'orange-five-2020',title:'Orange Five Factory 2020 archive',url:'https://orangebikes.com/blogs/bike-archive-2020/five-factory-2020',section:'Geometry & Tech Info; frame and fork',reviewed:'2026-10-16'};
const orangeSizes=[['S',429,599,1176,100],['M',447,608,1197,110],['L',467,608,1217,110],['XL',483,621,1240,125],['XXL',502,626,1261,130]];
export const CATALOGUE={schema:'bikelab-geometry-catalogue-1',units:{length:'m',angle:'rad'},sources:[orangeSource],records:orangeSizes.map(([size,reach,stack,wheelbase,headTube])=>({
  id:'orange-five-2020-'+size.toLowerCase(),brand:'Orange',model:'Five Factory / Mk12',year:2020,size,configuration:'150 mm fork; 27.5 wheels; unsagged',topology:'Direct single pivot',
  sourceIds:[orangeSource.id],fieldSources:{frame:orangeSource.id,suspension:orangeSource.id},
  frame:{reach:reach/1000,stack:stack/1000,wheelbase:wheelbase/1000,chainstay:.433,rearCentre:null,bbDrop:.025,headTube:headTube/1000,headAngle:radians(65),effectiveSeatAngle:radians(74)},
  suspension:{forkTravel:.150,rearTravel:.145,shockEye:.210,shockStroke:.055},
  mechanism:{pivotCoordinates:null,shockEyeCoordinates:null,linkLengths:null},simulationPreset:null,
  notes:['Manufacturer nominal dimensions, not measured calibration. Angles are static without rider sag. BB drop is positive below axles; the source gives −25 mm axle-relative height.','Source model is 2020; the archive page publication date is 2025. Shock-eye annotations and estimated pivot placement in the lab are separate from this record.']
}))};
const santaSource={id:'sc-hightower3-my23',title:'Santa Cruz Hightower 3 MY23 support',url:'https://web.santacruzbicycles.com/pages/product-support/hightower-3-my23',section:'Geometry; shock specifications; linkage parts',reviewed:'2026-10-16'};
const transitionFit={id:'transition-sentinel-2022-fit',title:'Transition Sentinel Carbon 2022 archive PDF',url:'https://www.transitionbikes.com/SupportFiles/SentinelCarbon2022.pdf',section:'Page 16 geometry table',reviewed:'2026-10-16'};
const transitionSpec={id:'transition-sentinel-2020-24-spec',title:'Transition Sentinel Carbon 2020–24 support',url:'https://www.transitionbikes.com/Product-Support-By-Model-Version-Details/Sentinel-Carbon/18',section:'Frame specifications; shock and mounting hardware',reviewed:'2026-10-16'};
CATALOGUE.sources.push(santaSource,transitionFit,transitionSpec);
for(const [setting,reach,stack,angle,drop,wheelbase,rearCentre] of [['Low',452,627,64.5,34,1218,435],['High',455,625,64.8,31,1217,434]])CATALOGUE.records.push({
  id:'santa-cruz-hightower3-2023-m-'+setting.toLowerCase(),brand:'Santa Cruz',model:'Hightower 3',year:2023,size:'M',configuration:setting+'; 150 mm fork; 29 wheels',topology:'VPP · upper and lower links',
  sourceIds:[santaSource.id],fieldSources:{frame:santaSource.id,suspension:santaSource.id},
  frame:{reach:reach/1000,stack:stack/1000,wheelbase:wheelbase/1000,chainstay:null,rearCentre:rearCentre/1000,bbDrop:drop/1000,headTube:null,headAngle:radians(angle),effectiveSeatAngle:null},
  suspension:{forkTravel:.150,rearTravel:.145,shockEye:.210,shockStroke:.055},
  hardware:{frontShock:{width:.030,boltDiameter:.008},rearShock:{width:.030,boltDiameter:.008},sourceId:santaSource.id},
  mechanism:{pivotCoordinates:null,shockEyeCoordinates:null,linkLengths:null},simulationPreset:null,
  notes:['Manufacturer nominal dimensions. Rear centre retains the source terminology; it is not silently substituted for a measured chainstay link length.','High and Low are separate configurations. Exploded linkage drawings identify parts and topology, but do not dimension the kinematic pivots. VPP is not supported by the current single-pivot solver.']
});
CATALOGUE.records.push({
  id:'transition-sentinel-carbon-2022-md-150',brand:'Transition',model:'Sentinel Carbon',year:2022,size:'MD',configuration:'2020–24 generation; 160 mm fork; 150 mm rear; 29 wheels',topology:'Linkage suspension · requires a separate mechanism model',
  sourceIds:[transitionFit.id,transitionSpec.id],fieldSources:{frame:transitionFit.id,suspension:transitionSpec.id},
  frame:{reach:.450,stack:.622,wheelbase:1.233,chainstay:.440,rearCentre:null,bbDrop:.029,headTube:null,headAngle:radians(63.6),effectiveSeatAngle:null},
  suspension:{forkTravel:.160,rearTravel:.150,shockEye:.205,shockStroke:.0625},
  hardware:{upperShock:{type:'trunnion'},lowerShock:{width:.025,boltDiameter:.008},sourceId:transitionSpec.id},
  mechanism:{pivotCoordinates:null,shockEyeCoordinates:null,linkLengths:null},simulationPreset:null,
  notes:['Fit dimensions are from the 2022 archive; support specifications cover the 2020–24 generation. This does not assert identical fit geometry for every year.','The alternative 205 × 57.5 mm / 140 mm rear-travel option is not mixed into this 150 mm configuration. Nominal shock mounting length for a trunnion shock is not interchangeable with conventional two-eye hardware.']
});
export const REFERENCE_FIELDS=[
  ['frame','reach','Reach','mm'],['frame','stack','Stack','mm'],['frame','wheelbase','Wheelbase','mm'],['frame','chainstay','Chainstay (source label)','mm'],['frame','rearCentre','Rear centre (source label)','mm'],['frame','bbDrop','BB drop below axles','mm'],['frame','headTube','Head tube','mm'],['frame','headAngle','Head angle','°'],['frame','effectiveSeatAngle','Effective seat angle','°'],
  ['suspension','forkTravel','Fork travel','mm'],['suspension','rearTravel','Rear travel','mm'],['suspension','shockEye','Shock mounting length','mm'],['suspension','shockStroke','Shock stroke','mm']
];
export function referenceRows(record){return REFERENCE_FIELDS.map(([group,key,label,unit])=>({label,unit,value:record[group][key]??null,display:record[group][key]==null?'Not sourced':Number((record[group][key]*(unit==='°'?180/Math.PI:1000)).toFixed(2)).toString(),sourceId:record.fieldSources[group]}));}
