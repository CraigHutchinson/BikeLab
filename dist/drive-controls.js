// Complete, right-continuous hub commands. Bounds define this experiment, not component ratings.
export const ZERO_COMMAND=Object.freeze({tick:0,rearDrive:0,frontBrake:0,rearBrake:0});
export function validateCommands(input,steps){
 const commands=input===undefined?[ZERO_COMMAND]:input;
 if(!Array.isArray(commands)||commands.length<1||commands.length>64)throw Error('Provide 1 through 64 drive/brake commands.');
 let previous=-1;
 return Object.freeze(Array.from(commands,c=>{
  if(!c||typeof c!=='object'||Array.isArray(c)||![Object.prototype,null].includes(Object.getPrototypeOf(c))||Object.keys(c).length!==4||Object.keys(ZERO_COMMAND).some(k=>!Object.hasOwn(c,k)))throw Error('Each command requires tick, rearDrive, frontBrake and rearBrake.');
  if(!Number.isSafeInteger(c.tick)||c.tick<0||c.tick>steps||c.tick<=previous||(previous===-1&&c.tick!==0))throw Error('Command ticks must start at zero, increase strictly and stay within the run.');
  if(!Number.isFinite(c.rearDrive)||Math.abs(c.rearDrive)>120||![c.frontBrake,c.rearBrake].every(v=>Number.isFinite(v)&&v>=0&&v<=200))throw Error('Drive must be within ±120 N m and each brake capacity within [0, 200] N m.');
  previous=c.tick;
  return Object.freeze({tick:c.tick,rearDrive:c.rearDrive,frontBrake:c.frontBrake,rearBrake:c.rearBrake});
 }));
}
