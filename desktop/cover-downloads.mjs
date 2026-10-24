import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
const mbid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function createCoverService({directory,nativeImage,version,fetch:request=(...args)=>globalThis.fetch(...args)}) {
  let index, busy=false, lastSearch=0;
  const previews=new Map();
  const headers={'User-Agent':`MandoPlayMusic/${version} (https://github.com/thedoghouse-dev/mando-playmusic)`};
  async function loadIndex(){if(!index){try{index=JSON.parse(await readFile(path.join(directory,'index.json'),'utf8'));}catch{index={};}}return index;}
  const key=file=>createHash('sha256').update(path.resolve(file)).digest('hex');
  async function bounded(url,limit){
    const response=await request(url,{headers,signal:AbortSignal.timeout(20000)});
    if(response.status===404)return null;
    if(!response.ok)throw Error(response.status===429||response.status===503?'The artwork service is busy. Please try again later.':'The artwork service could not complete this request.');
    const chunks=[];let size=0;
    if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw Error('Artwork response is too large.');}
    for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw Error('Artwork response is too large.');chunks.push(Buffer.from(chunk));}
    return Buffer.concat(chunks);
  }
  async function search(artist,album){
    if(typeof artist!=='string'||typeof album!=='string'||!album.trim()||artist.length>200||album.length>200)throw Error('Enter an artist and album title (up to 200 characters each).');
    if(busy||Date.now()-lastSearch<1100)throw Error('Please wait a moment before searching again.');
    busy=true;lastSearch=Date.now();
    try{
      const quote=value=>'"'+value.replace(/[\\"]/g,'\\$&')+'"';
      const url=new URL('https://musicbrainz.org/ws/2/release-group/');url.search=new URLSearchParams({query:`releasegroup:${quote(album.trim())}${artist.trim()?' AND artist:'+quote(artist.trim()):''}`,fmt:'json',limit:'8'});
      const bytes=await bounded(url,2*1024*1024);if(!bytes)return [];
      return (JSON.parse(bytes)['release-groups']||[]).filter(item=>mbid.test(item.id)).map(item=>({id:item.id,title:String(item.title||''),artist:(item['artist-credit']||[]).map(a=>a.name||a.artist?.name||'').join(', '),year:String(item['first-release-date']||''),type:String(item['primary-type']||'Album')}));
    }catch(error){if(error.name==='TimeoutError'||error instanceof TypeError)throw Error('Could not connect to the artwork service. Check your internet connection and try again.');throw error;}finally{busy=false;}
  }
  async function preview(id){
    if(typeof id!=='string'||!mbid.test(id))throw Error('Choose an album from the search results.');
    if(previews.has(id))return previews.get(id);
    const bytes=await bounded(`https://coverartarchive.org/release-group/${id}/front-500`,12*1024*1024);
    if(!bytes)throw Error('No front cover is available for this result. Try another album.');
    const image=nativeImage.createFromBuffer(bytes);if(image.isEmpty())throw Error('This cover image could not be opened.');
    const size=image.getSize(),scale=Math.min(1,500/Math.max(size.width,size.height));
    const png=image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:'good'}).toPNG();
    previews.set(id,png);while(previews.size>8)previews.delete(previews.keys().next().value);
    return png;
  }
  async function save(id,files){
    if(!previews.has(id))throw Error('Preview this cover before saving it.');
    if(!Array.isArray(files)||!files.length)throw Error('The album is no longer available.');
    const current=await loadIndex(),next={...current};for(const file of files)next[key(file)]=id;
    await mkdir(directory,{recursive:true});await writeFile(path.join(directory,id+'.png'),previews.get(id));
    const temporary=path.join(directory,randomUUID()+'.tmp');await writeFile(temporary,JSON.stringify(next));await rename(temporary,path.join(directory,'index.json'));index=next;
  }
  async function read(file){const id=(await loadIndex())[key(file)];if(!mbid.test(id||''))return null;try{return await readFile(path.join(directory,id+'.png'));}catch{return null;}}
  return {search,preview,save,read};
}
