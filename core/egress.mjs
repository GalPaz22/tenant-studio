// Every scraper leaves through one exit. STUDIO_SCRAPE_PROXY (http://, https:// or socks5:// URL, optional user:pass)
// routes all site fetches through that proxy/VPN endpoint; unset, they go out directly as before.
// With a proxy set there is no direct fallback: a proxy that fails is an error, never a silent request from our own IP.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

export function proxyConfig(value=process.env.STUDIO_SCRAPE_PROXY){
 if(!value)return null;
 let u;try{u=new URL(value)}catch{throw Error('STUDIO_SCRAPE_PROXY אינו כתובת תקינה');}
 const kind={'http:':'http','https:':'https','socks5:':'socks5','socks5h:':'socks5'}[u.protocol];
 if(!kind||!u.hostname)throw Error('STUDIO_SCRAPE_PROXY תומך רק ב-http, https או socks5');
 return {kind,host:u.hostname,port:Number(u.port)||{http:80,https:443,socks5:1080}[kind],user:decodeURIComponent(u.username),pass:decodeURIComponent(u.password)};
}
const TIMEOUT=20000;
const reader=socket=>{ // reads exactly n bytes of the proxy handshake
 let buf=Buffer.alloc(0),want=null;
 const fail=e=>{want?.fail(e instanceof Error?e:Error('הפרוקסי סגר את החיבור'));want=null;},pump=()=>{if(want&&buf.length>=want.n){const out=buf.subarray(0,want.n);buf=buf.subarray(want.n);const {ok}=want;want=null;ok(out);}};
 const onData=c=>{buf=Buffer.concat([buf,c]);pump();};socket.on('data',onData);socket.once('error',fail);socket.once('close',fail);
 return {read:n=>new Promise((ok,fail)=>{want={n,ok,fail};pump();}),done:()=>{socket.off('data',onData);socket.off('error',fail);socket.off('close',fail);if(buf.length)socket.unshift(buf);}};
};
async function socks5(socket,p,host,port){
 const r=reader(socket);
 try{
  socket.write(Buffer.from(p.user?[5,2,0,2]:[5,1,0]));
  const [ver,method]=await r.read(2);if(ver!==5||method===0xff)throw Error('הפרוקסי דחה את שיטת האימות');
  if(method===2){const u=Buffer.from(p.user),w=Buffer.from(p.pass);socket.write(Buffer.concat([Buffer.from([1,u.length]),u,Buffer.from([w.length]),w]));if((await r.read(2))[1]!==0)throw Error('אימות הפרוקסי נכשל');}
  // The hostname goes to the proxy unresolved, so the exit side does the DNS lookup too.
  const name=Buffer.from(host);socket.write(Buffer.concat([Buffer.from([5,1,0,3,name.length]),name,Buffer.from([port>>8,port&255])]));
  const head=await r.read(4);if(head[1]!==0)throw Error('הפרוקסי לא הצליח להתחבר ליעד (SOCKS '+head[1]+')');
  await r.read(head[3]===1?6:head[3]===4?18:(await r.read(1))[0]+2);
 }finally{r.done();}
}
function httpConnect(socket,p,host,port){
 return new Promise((ok,fail)=>{
  let buf=Buffer.alloc(0);const end=()=>fail(Error('הפרוקסי סגר את החיבור'));
  const onData=c=>{buf=Buffer.concat([buf,c]);const i=buf.indexOf('\r\n\r\n');if(i<0){if(buf.length>16384)done(Error('תשובת פרוקסי לא תקינה'));return;}
   const status=Number(/^HTTP\/1\.[01] (\d{3})/.exec(buf.toString('latin1',0,i))?.[1]);
   if(status!==200)return done(Error(status===407?'אימות הפרוקסי נכשל':'הפרוקסי לא הצליח להתחבר ליעד (HTTP '+(status||'?')+')'));
   const rest=buf.subarray(i+4);done(null);if(rest.length)socket.unshift(rest);};
  const done=e=>{socket.off('data',onData);socket.off('error',fail);socket.off('close',end);e?fail(e):ok();};
  socket.on('data',onData);socket.once('error',fail);socket.once('close',end);
  socket.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n${p.user?'Proxy-Authorization: Basic '+Buffer.from(p.user+':'+p.pass).toString('base64')+'\r\n':''}\r\n`);
 });
}
// A raw TCP tunnel to host:port through the proxy.
export function tunnel(p,host,port){
 return new Promise((ok,fail)=>{
  const socket=p.kind==='https'?tls.connect({host:p.host,port:p.port,servername:p.host}):net.connect({host:p.host,port:p.port});
  const timer=setTimeout(()=>socket.destroy(Error('תם הזמן לחיבור לפרוקסי')),TIMEOUT),bad=e=>{clearTimeout(timer);socket.destroy();fail(Error('פרוקסי הסריקה לא זמין: '+e.message));};
  socket.once('error',bad);
  socket.once(p.kind==='https'?'secureConnect':'connect',async()=>{
   try{await (p.kind==='socks5'?socks5:httpConnect)(socket,p,host,port);clearTimeout(timer);socket.off('error',bad);ok(socket);}catch(e){bad(e);}
  });
 });
}
class TunnelAgent extends https.Agent{
 constructor(proxy){super({keepAlive:false});this.proxy=proxy;}
 createConnection(options,callback){
  tunnel(this.proxy,options.host||options.hostname,Number(options.port)||443).then(socket=>callback(null,tls.connect({socket,servername:options.servername||options.host,ALPNProtocols:['http/1.1']})),callback);
 }
}
// The agent for https.request, or undefined when scraping goes out directly.
let cached={key:null,agent:undefined};
export function scrapeAgent(){
 const key=process.env.STUDIO_SCRAPE_PROXY||'';if(key===cached.key)return cached.agent;
 const p=proxyConfig(key);cached={key,agent:p?new TunnelAgent(p):undefined};return cached.agent;
}
// fetch() for scrapers: the platform fetch when direct; through the proxy otherwise (GET, no automatic redirects,
// which is how the crawler calls it).
export function scrapeFetch(url,init={}){
 const agent=scrapeAgent();if(!agent)return fetch(url,init);
 if(new URL(url).protocol!=='https:')return Promise.reject(Error('נדרשת כתובת HTTPS'));
 return new Promise((ok,fail)=>{
  const req=https.request(url,{method:init.method||'GET',headers:init.headers||{},agent},res=>{
   const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',fail);
   res.on('end',()=>{const body=Buffer.concat(chunks);ok({status:res.statusCode,ok:res.statusCode>=200&&res.statusCode<300,headers:{get:n=>{const v=res.headers[String(n).toLowerCase()];return v===undefined?null:Array.isArray(v)?v.join(', '):v;}},text:async()=>body.toString(),json:async()=>JSON.parse(body.toString())});});
  });
  req.on('error',fail);init.signal?.addEventListener('abort',()=>req.destroy(init.signal.reason||Error('aborted')),{once:true});req.end(init.body);
 });
}
export const scrapeExit=()=>{const p=proxyConfig();return p?{proxied:true,kind:p.kind,host:p.host,port:p.port}:{proxied:false};};
