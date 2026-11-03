import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const prefix='/tongpin-showcase/';
const types={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'};

export async function startStaticServer(){
  const server=createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(!pathname.startsWith(prefix)){res.writeHead(404).end();return;}
      const relative=pathname.slice(prefix.length)||'index.html';
      if(!/^(index\.html|content\.json|app\.js|styles\.css|playful\.css|showcase\.css|assets\/[\w/.-]+)$/.test(relative)){res.writeHead(404).end();return;}
      const target=path.resolve(root,relative);
      if(!target.startsWith(root+path.sep)){res.writeHead(404).end();return;}
      const bytes=await readFile(target);
      res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {base:`http://127.0.0.1:${server.address().port}${prefix}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
