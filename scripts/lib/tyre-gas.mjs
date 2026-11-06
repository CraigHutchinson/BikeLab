// Shared sealed polytropic gas law. SI, fixed mass, no heat-transfer or leakage state.
export class PressureDomainError extends RangeError {
 constructor(code,message){super(message);this.name='PressureDomainError';this.code=code;}
}
const exprel=x=>x===0?1:Math.expm1(x)/x;
// Internal validated configurations; signed loss retains tiny prescribed compression.
export function polytropicState(config,loss){
 const {referenceVolume:V0,initialGaugePressure:pg0,ambientPressure:pa,exponent:n,minVolumeFraction}=config,z=loss/V0,maxVolumeFraction=config.maxVolumeFraction??1;
 if(!Number.isFinite(z)||z<1-maxVolumeFraction||z>1-minVolumeFraction)throw new PressureDomainError('volume-domain','Volume outside the declared sealed-chamber envelope');
 if(loss!==0&&z===0)throw new PressureDomainError('volume-resolution','Relative volume change is below numeric resolution');
 const logRatio=-Math.log1p(-z),P0=pg0+pa;
 const pressureIncrease=P0*Math.expm1(n*logRatio),gaugePressure=pg0+pressureIncrease,absolutePressure=pa+gaugePressure;
 const excess=Math.abs(z)<1e-4?z*z*n*(1/2+z*(n+1)*(1/6+z*(n+2)*(1/24+z*(n+3)*(1/120+z*(n+4)/720)))):logRatio*exprel((n-1)*logRatio)-z;
 const energy=pg0*loss+P0*V0*excess,volume=V0-loss,coupling=n*absolutePressure/volume;
 if(loss>0&&energy===0)throw new PressureDomainError('energy-resolution','Compression work is below numeric resolution');
 if(![volume,absolutePressure,gaugePressure,energy,coupling].every(Number.isFinite)||(loss>=0&&energy<0))throw new PressureDomainError('nonfinite-result','Pressure state is not numerically admissible');
 return {volume,volumeLoss:loss,absolutePressure,gaugePressure,pressureIncrease,energy,coupling};
}
export function createSealedGas(input){
 const keys=['referenceVolume','initialGaugePressure','ambientPressure','exponent','minVolumeFraction','maxVolumeFraction','provenance'];
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).length!==keys.length||Reflect.ownKeys(input).some(k=>!keys.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(input,k),'value')))throw TypeError('Invalid gas configuration');
 for(const [key,lo,hi] of [['referenceVolume',1e-6,.1],['initialGaugePressure',0,2e6],['ambientPressure',1e4,2e5],['exponent',1,1.4],['minVolumeFraction',.05,.99],['maxVolumeFraction',1,2]])if(!Number.isFinite(input[key])||input[key]<lo||input[key]>hi)throw RangeError('Invalid gas '+key);
 if(typeof input.provenance!=='string'||!input.provenance.trim()||input.provenance.length>2000)throw TypeError('Gas provenance required');
 const config={...input};
 return Object.freeze({evaluate(volume){if(!Number.isFinite(volume))throw new PressureDomainError('volume-domain','Nonfinite volume');return polytropicState(config,config.referenceVolume-volume);}});
}
