export function readPackInBackground(name,buffer){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./pack-worker.js',import.meta.url),{type:'module'});
  const finish=(error,pack)=>{worker.terminate();error?reject(Error(error)):resolve(pack);};
  worker.onmessage=({data})=>finish(data.error,data.pack);
  worker.onerror=event=>finish(event.message||'Could not read preset pack.');
  worker.postMessage({name,buffer},[buffer]);
 });
}
