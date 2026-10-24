export const MANDO_SCENES=[{id:'mando:aurora',name:'Mando · Aurora'},{id:'mando:orbit',name:'Mando · Orbit'},{id:'mando:prism',name:'Mando · Prism'}];
export function makeMandoPreset(id){
 const mode=id==='mando:orbit'?1:id==='mando:prism'?2:0;
 return {baseVals:{decay:.965,gammaadj:1.5,wave_mode:mode===1?0:mode===2?7:5,wave_a:.85,wave_scale:1.6,wave_smoothing:.65,wave_thick:1,additivewave:1,wave_brighten:1,wrap:1,zoom:1.012,warp:.3,warpanimspeed:.7,warpscale:1.5,echo_alpha:.12,echo_zoom:1.008,ob_size:.008,ob_a:.2,ob_r:.2,ob_g:.6,ob_b:.4,mv_a:0},init_eqs:m=>m,frame_eqs:m=>{m.zoom=1.006+.006*Math.min(3,m.bass_att);m.rot=Math.sin(m.time*.19+mode)*.005;m.warp=.2+.15*Math.sin(m.time*.11);m.wave_x=.5+.1*Math.sin(m.time*.23);m.wave_y=.5+.12*Math.cos(m.time*.17);m.wave_r=.5+.4*Math.sin(m.time*.31);m.wave_g=.6+.3*Math.sin(m.time*.23+2);m.wave_b=.6+.3*Math.cos(m.time*.19);return m;},pixel_eqs:'',warp:'',comp:'',waves:[],shapes:mode===1?[{baseVals:{enabled:1,sides:80,additive:1,x:.5,y:.5,rad:.2,a:.1,a2:0,border_a:.7,r:.3,g:.8,b:.9,r2:.1,g2:.2,b2:.4,border_r:.5,border_g:.9,border_b:1},init_eqs:m=>m,frame_eqs:m=>{m.ang=m.time*.15;m.rad=.18+.05*Math.sin(m.time*.7);return m;}}]:[]};
}
const color=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export function customizePreset(preset,getSettings,getSignal){
 const wrap=(original,kind)=>(m)=>{
  m=original?original(m):m;const s=getSettings(),signal=getSignal();if(s.engine!=='mando')return m;
  const a=color(s.colorA),b=color(s.colorB),mix=.5+.5*Math.sin((m.time||0)*.25),rgb=a.map((v,i)=>v*(1-mix)+b[i]*mix);
  if(kind==='preset'){
   m.wave_r=rgb[0];m.wave_g=rgb[1];m.wave_b=rgb[2];m.ob_r=a[0];m.ob_g=a[1];m.ob_b=a[2];
   m.zoom=Math.min(1.15,Math.max(.85,(Number.isFinite(m.zoom)?m.zoom:1)+signal.pulse*.009*s.sensitivity));
   m.wave_scale=Math.min(10,Math.max(.1,(m.wave_scale||1)*(1+signal.pulse*.22*s.sensitivity)));
  }else{m.r=rgb[0];m.g=rgb[1];m.b=rgb[2];if(kind==='shape')m.rad=Math.min(1.5,(m.rad||.1)*(1+signal.pulse*.2*s.sensitivity));}
  return m;
 };
 return {...preset,frame_eqs:wrap(preset.frame_eqs,'preset'),waves:(preset.waves||[]).map(w=>({...w,frame_eqs:wrap(w.frame_eqs,'wave')})),shapes:(preset.shapes||[]).map(w=>({...w,frame_eqs:wrap(w.frame_eqs,'shape')}))};
}

// Butterchurn draws four slots whenever a preset has any custom shapes/waves.
export function normalizeRendererPreset(preset){
 const slots=values=>!values?.length?[]:Array.from({length:4},(_,i)=>values[i]||{baseVals:{enabled:0},init_eqs:a=>a,frame_eqs:a=>a,point_eqs:a=>a});
 return {...preset,shapes:slots(preset.shapes),waves:slots(preset.waves)};
}
