export const DEFAULT_VISUAL_SETTINGS = Object.freeze({engine:'mando',sensitivity:1,colorA:'#b9ed8d',colorB:'#62d9e8',blend:2,interval:30,transition:'beat',auto:true,presetId:'mando:aurora',favorites:[]});
const clamp=(v,lo,hi,fallback)=>Number.isFinite(Number(v))?Math.min(hi,Math.max(lo,Number(v))):fallback;
export function normalizeVisualSettings(input={}) {
 const d=DEFAULT_VISUAL_SETTINGS,s=input&&typeof input==='object'?input:{};
 return {engine:s.engine==='classic'?'classic':'mando',sensitivity:clamp(s.sensitivity,.25,3,d.sensitivity),colorA:/^#[0-9a-f]{6}$/i.test(s.colorA)?s.colorA:d.colorA,colorB:/^#[0-9a-f]{6}$/i.test(s.colorB)?s.colorB:d.colorB,blend:clamp(s.blend,0,8,d.blend),interval:clamp(s.interval,5,120,d.interval),transition:s.transition==='timed'?'timed':'beat',auto:typeof s.auto==='boolean'?s.auto:d.auto,presetId:typeof s.presetId==='string'?s.presetId:d.presetId,favorites:Array.isArray(s.favorites)?s.favorites.filter(v=>typeof v==='string'):[]};
}
export class BeatDetector {
 constructor(){this.reset();}
 reset(){this.average=0;this.previous=0;this.lastBeat=-Infinity;this.lastTime=null;this.pulse=0;}
 update(energy,rms,time,sensitivity=1){
  energy=Number.isFinite(energy)?Math.max(0,energy):0;
  const dt=this.lastTime===null?33:Math.max(1,Math.min(100,time-this.lastTime));this.lastTime=time;
  const alpha=1-Math.exp(-dt/700),baseline=this.average;
  const threshold=1.65/Math.sqrt(Math.max(.25,sensitivity));
  const beat=rms>.006&&energy>.008&&energy>Math.max(.008,baseline*threshold)&&energy>this.previous*1.08&&time-this.lastBeat>200;
  this.average+=alpha*(energy-this.average);this.previous=energy;this.pulse*=Math.exp(-dt/220);
  if(beat){this.lastBeat=time;this.pulse=1;}
  return {beat,pulse:this.pulse,energy,rms};
 }
}
export function shouldTransition(settings,now,lastPreset,beat,playing){
 const elapsed=now-lastPreset;
 return settings.auto&&playing&&elapsed>=settings.interval*1000&&(settings.transition==='timed'||beat||elapsed>=settings.interval*1000+3000);
}
