export const MILK_PRESET=`[preset00]
fDecay=0.96
nWaveMode=0
fWaveAlpha=1
fWaveScale=3
fWaveSmoothing=0.7
bAdditiveWaves=1
bWaveThick=1
fZoom=1.012
fWarpAmount=0.4
per_frame_1=zoom=1.005+0.008*bass_att;
per_frame_2=rot=0.003*sin(time*0.3);
per_frame_3=wave_r=0.5+0.4*sin(time*0.5);
per_frame_4=wave_g=0.8;
per_frame_5=wave_b=0.6;
`;
export const SHADER_PRESET=MILK_PRESET+`warp_1=\`shader_body
warp_2=\`{
warp_3=\`ret = tex2D(sampler_main, uv).xyz * 0.98;
warp_4=\`}
`;
export const CONVERTED_PRESET={baseVals:{wave_a:1,wave_scale:2,wave_mode:0,decay:.97},init_eqs_str:'',frame_eqs_str:'a.zoom=1.01;a.wave_r=0.3;a.wave_g=0.9;a.wave_b=0.7;',pixel_eqs_str:'',waves:[],shapes:[],warp:'',comp:''};
