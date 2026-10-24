import {readPackBytes} from './packs.js';
self.onmessage=({data})=>{try{self.postMessage({pack:readPackBytes(data.name,new Uint8Array(data.buffer))});}catch(error){self.postMessage({error:error.message});}};
