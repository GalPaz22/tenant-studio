import test from 'node:test';
import assert from 'node:assert/strict';
import {rowsToCheck,checkPage,checkPages,classify} from './core/page-check.mjs';

test('page check asks only never-stamped rows of a stamped catalog; HEAD, then GET when HEAD is refused',async()=>{
 const rows=[{id:1,url:'https://s.co/1',lastSeenAt:'2026-10-19'},{id:2,url:'https://s.co/2',lastSeenAt:'2026-10-19'},{id:3,url:'https://s.co/404'},{id:4,url:'javascript:x'}];
 assert.deepEqual(rowsToCheck(rows).map(r=>r.id),[3]);assert.deepEqual(rowsToCheck(rows,{all:true}).map(r=>r.id),[1,2,3]);
 assert.deepEqual(rowsToCheck([{id:1,url:'https://s.co/1'}]),[],'no sync stamps: nothing to suspect');
 const calls=[],fetch=async(url,{method})=>{calls.push(method);if(url.endsWith('/err'))throw Error('down');return {status:url.endsWith('/head-405')&&method==='HEAD'?405:Number(url.split('/').pop())||200,body:null};};
 assert.equal(await checkPage('https://s.co/head-405',{fetch}),200);assert.deepEqual(calls,['HEAD','GET']);
 const out=await checkPages([{id:'a',url:'https://s.co/404'},{id:'b',url:'https://s.co/err'},{id:'c',url:'https://s.co/403'},{id:'d',url:'https://s.co/410'},{id:'e',url:'https://s.co/x'}],{fetch,delayMs:0});
 assert.deepEqual(out.map(r=>classify(r.status)),['gone','unknown','unknown','gone','live']);
});
