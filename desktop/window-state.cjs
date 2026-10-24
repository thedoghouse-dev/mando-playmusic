const finite=value=>typeof value==='number'&&Number.isFinite(value);
function validBounds(bounds){return bounds&&['x','y','width','height'].every(key=>finite(bounds[key]))&&Math.abs(bounds.x)<1e7&&Math.abs(bounds.y)<1e7&&bounds.width>0&&bounds.height>0;}
function resolveVisualizerState(saved,displays,fallback){
 const remembered=displays.find(display=>display.id===saved?.displayId);
 const display=remembered||fallback||displays[0],area=display.workArea;
 const usable=validBounds(saved?.bounds),width=Math.min(area.width,Math.max(400,usable?saved.bounds.width:1100)),height=Math.min(area.height,Math.max(300,usable?saved.bounds.height:720));
 let x=area.x+Math.round((area.width-width)/2),y=area.y+Math.round((area.height-height)/2);
 if(remembered&&usable){const old=validBounds(saved.workArea)?saved.workArea:area;x=area.x+saved.bounds.x-old.x;y=area.y+saved.bounds.y-old.y;}
 x=Math.round(Math.max(area.x,Math.min(x,area.x+area.width-width)));y=Math.round(Math.max(area.y,Math.min(y,area.y+area.height-height)));
 return {bounds:{x,y,width:Math.round(width),height:Math.round(height)},fullscreen:saved?.fullscreen===true};
}
module.exports={resolveVisualizerState};
