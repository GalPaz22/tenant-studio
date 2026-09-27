import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {rewriteHtml,rewriteCss,rewriteAbsolute,createMirror,mirrorHosts} from './core/site-mirror.mjs';
import {demoProductUrl} from './server.mjs';

const hosts=mirrorHosts('https://www.shop.co.il/'),prefix='/demo/abc';
test('plugin demo keeps same-store product links inside the read-only mirror',()=>{
 assert.equal(demoProductUrl('abc','https://www.store.example','https://store.example/products/watch?x=1'),'/demo/abc/products/watch?x=1');
 assert.equal(demoProductUrl('abc','https://store.example','https://external.example/watch'),'https://external.example/watch');
 assert.equal(demoProductUrl('abc','https://store.example','javascript:alert(1)'),null);
});
test('absolute, protocol-relative and JSON-escaped store URLs stay in the mirror; other hosts are untouched',()=>{
 assert.equal(rewriteAbsolute('a https://www.shop.co.il/p/1 b //shop.co.il/x.js c https://cdn.other.com/y',hosts,prefix),'a /demo/abc/p/1 b /demo/abc/x.js c https://cdn.other.com/y');
 assert.equal(rewriteAbsolute('{"u":"https:\\/\\/www.shop.co.il\\/cart"}',hosts,prefix),'{"u":"\\/demo\\/abc\\/cart"}');
 assert.equal(rewriteAbsolute('https://www.shop.co.il.evil.com/',hosts,prefix),'https://www.shop.co.il.evil.com/');
});
test('html attributes, srcset, styles and blockers are rewritten; overlay injected in head',()=>{
 const out=rewriteHtml('<html><head><meta http-equiv="Content-Security-Policy" content="x"><base href="/"><link rel=stylesheet href="/a.css" integrity="sha-1"></head><body><a href="/p/1">x</a><img srcset="/i1.jpg 1x, /i2.jpg 2x" src="//www.shop.co.il/i.jpg"><form action="/search"></form><div style="background:url(/bg.png)"></div><a href="/demo/abc/ok">k</a></body></html>',{hosts,prefix,inject:'<script id=o></script>'});
 assert.match(out,/<head><script id=o><\/script>/);
 assert.ok(!/Content-Security-Policy|<base|integrity/i.test(out));
 for(const s of ['href="/demo/abc/a.css"','href="/demo/abc/p/1"','srcset="/demo/abc/i1.jpg 1x, /demo/abc/i2.jpg 2x"','src="/demo/abc/i.jpg"','action="/demo/abc/search"','url(/demo/abc/bg.png)','href="/demo/abc/ok"'])assert.ok(out.includes(s),s);
});
test('css url() and @import',()=>{
 assert.equal(rewriteCss('@import "/b.css";a{background:url("/x.png")}b{background:url(data:x)}',hosts,prefix),'@import "/demo/abc/b.css";a{background:url("/demo/abc/x.png")}b{background:url(data:x)}');
});
test('mirror serves only the project host, strips blocking headers, rewrites redirects and caches',async()=>{
 let calls=0;
 const fetcher=async url=>{calls++;if(url.endsWith('/old'))return {status:301,headers:{location:'https://www.shop.co.il/new'},body:Buffer.from('')};return {status:200,headers:{'content-type':'text/html; charset=utf-8','content-security-policy':'default-src none','x-frame-options':'DENY','set-cookie':'a=b'},body:Buffer.from('<head></head><a href="/x">x</a>')};};
 const m=createMirror({dataDir:await mkdtemp(join(tmpdir(),'mirror-')),fetcher});
 const project={id:'abc',url:'https://www.shop.co.il/'};
 const r=await m.serve(project,'/',{overlay:'<i>o</i>'});
 assert.equal(r.status,200);assert.ok(!r.headers['content-security-policy']&&!r.headers['x-frame-options']&&!r.headers['set-cookie']);
 assert.equal(r.body.toString(),'<head><i>o</i></head><a href="/demo/abc/x">x</a>');
 assert.equal((await m.serve(project,'/',{})).fromCache,true);assert.equal(calls,1);
 assert.equal((await m.serve(project,'/',{refresh:true})).fromCache,false);assert.equal(calls,2);
 assert.equal((await m.serve(project,'/old')).headers.location,'/demo/abc/new');
 await assert.rejects(m.serve(project,'//evil.com/x'),/מחוץ/);
});

test('bot-protection pages are recognised, never cached, and pause background fetches',async()=>{
 const {isChallenge,SiteBlocked}=await import('./core/site-mirror.mjs');
 const html=(status,body)=>({status,headers:{'content-type':'text/html'},body:Buffer.from(body)});
 assert.ok(isChallenge(html(429,'<title>Your connection needs to be verified</title>')));
 assert.ok(isChallenge(html(200,'<div id="challenge-platform">Just a moment...</div>')));
 assert.ok(!isChallenge(html(200,'<script src="https://www.google.com/recaptcha/api.js"></script>'+'x'.repeat(50000))),'a normal page that loads recaptcha is not a challenge');
 let calls=0;const fetcher=async()=>{calls++;return html(403,'Attention Required! | Cloudflare challenge-platform');};
 const m=createMirror({dataDir:await mkdtemp(join(tmpdir(),'mirror-')),fetcher}),project={id:'blk',url:'https://www.shop.co.il/'};
 await assert.rejects(m.serve(project,'/search?q=a'),SiteBlocked);
 await assert.rejects(m.fetchText(project,'https://www.shop.co.il/search?q=b'),SiteBlocked);
 assert.equal(calls,1,'harvest paused without contacting the site');assert.ok(m.blockedUntil('blk')>9*60000);
});
