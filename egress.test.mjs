import {test} from 'node:test';import assert from 'node:assert/strict';
import net from 'node:net';
import {proxyConfig,tunnel,scrapeAgent,scrapeFetch,scrapeExit} from './core/egress.mjs';

const listen=server=>new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));
const echo=()=>net.createServer(s=>s.on('data',c=>s.write('echo:'+c)));
// Minimal proxies that record the target they were asked for and pipe to it.
const httpProxy=(seen,auth)=>net.createServer(s=>s.once('data',c=>{
 const head=c.toString(),[,host,port]=/^CONNECT ([^:]+):(\d+)/.exec(head);seen.push(host+':'+port);
 if(auth&&!head.includes('Proxy-Authorization: Basic '+Buffer.from(auth).toString('base64')))return s.end('HTTP/1.1 407 Proxy Authentication Required\r\n\r\n');
 const up=net.connect(Number(port),'127.0.0.1',()=>{s.write('HTTP/1.1 200 Connection Established\r\n\r\n');s.pipe(up);up.pipe(s);});up.on('error',()=>s.destroy());
}));
const socksProxy=(seen,auth)=>net.createServer(s=>{
 let step=0;s.on('data',function on(c){
  if(step===0){step=auth?1:2;return s.write(Buffer.from([5,auth?2:0]));}
  if(step===1){const ul=c[1],user=c.subarray(2,2+ul).toString(),pass=c.subarray(3+ul,3+ul+c[2+ul]).toString(),ok=user+':'+pass===auth;step=2;s.write(Buffer.from([1,ok?0:1]));if(!ok)s.end();return;}
  s.off('data',on);const len=c[4],host=c.subarray(5,5+len).toString(),port=c.readUInt16BE(5+len);seen.push(host+':'+port);
  const up=net.connect(port,'127.0.0.1',()=>{s.write(Buffer.from([5,0,0,1,0,0,0,0,0,0]));s.pipe(up);up.pipe(s);});up.on('error',()=>s.destroy());
 });
});
const roundTrip=socket=>new Promise((ok,fail)=>{socket.once('data',d=>{socket.destroy();ok(d.toString());});socket.once('error',fail);socket.write('hi');});

test('proxy setting is parsed, unsupported schemes are rejected, and unset means direct',()=>{
 assert.equal(proxyConfig(''),null);
 assert.deepEqual(proxyConfig('socks5://us%40er:p%3Ass@vpn.example:1081'),{kind:'socks5',host:'vpn.example',port:1081,user:'us@er',pass:'p:ss'});
 assert.equal(proxyConfig('http://proxy.example').port,80);assert.equal(proxyConfig('socks5h://proxy.example').port,1080);
 for(const bad of ['ftp://x','not a url'])assert.throws(()=>proxyConfig(bad));
 const before=process.env.STUDIO_SCRAPE_PROXY;delete process.env.STUDIO_SCRAPE_PROXY;
 try{assert.equal(scrapeAgent(),undefined);assert.deepEqual(scrapeExit(),{proxied:false});
  process.env.STUDIO_SCRAPE_PROXY='http://u:secret@proxy.example:3128';assert.ok(scrapeAgent());assert.deepEqual(scrapeExit(),{proxied:true,kind:'http',host:'proxy.example',port:3128});
 }finally{if(before===undefined)delete process.env.STUDIO_SCRAPE_PROXY;else process.env.STUDIO_SCRAPE_PROXY=before;}
});

for(const [kind,make,scheme] of [['http CONNECT',httpProxy,'http'],['socks5',socksProxy,'socks5']])test(`${kind}: traffic reaches the target through the proxy, with the hostname left for the proxy to resolve`,async()=>{
 const seen=[],target=echo(),proxy=make(seen,'user:pass'),tp=await listen(target),pp=await listen(proxy);
 try{
  assert.equal(await roundTrip(await tunnel(proxyConfig(`${scheme}://user:pass@127.0.0.1:${pp}`),'shop.example',tp)),'echo:hi');assert.deepEqual(seen,['shop.example:'+tp]);
  await assert.rejects(tunnel(proxyConfig(`${scheme}://user:wrong@127.0.0.1:${pp}`),'shop.example',tp),/פרוקסי/);
 }finally{target.close();proxy.close();}
});

test('a proxy that is down fails the request instead of going out directly',async()=>{
 const dead=net.createServer(),port=await listen(dead);await new Promise(r=>dead.close(r));
 const before=process.env.STUDIO_SCRAPE_PROXY;process.env.STUDIO_SCRAPE_PROXY='http://127.0.0.1:'+port;
 try{await assert.rejects(scrapeFetch('https://example.com/'),/פרוקסי הסריקה לא זמין/);
  const {fetchPublic}=await import('./discover.mjs');await assert.rejects(fetchPublic('https://93.184.216.34/'),/פרוקסי הסריקה לא זמין/);
  const {fetchOrigin}=await import('./core/site-mirror.mjs');await assert.rejects(fetchOrigin('https://93.184.216.34/'),/פרוקסי הסריקה לא זמין/);
 }finally{if(before===undefined)delete process.env.STUDIO_SCRAPE_PROXY;else process.env.STUDIO_SCRAPE_PROXY=before;}
});
