import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applySpelling} from './core/core.mjs';

test('spelling corrections replace whole words once and never loop on a self-containing alias',()=>{
  assert.equal(applySpelling('מוצילה גדולה',{'מוצילה':"מוצ'ילה"}),applySpelling("מוצ'ילה גדולה",{}));
  assert.equal(applySpelling('ספא ספא',{'ספא':'מוצרי ספא'}),'מוצרי ספא מוצרי ספא');
  assert.equal(applySpelling('fenix 9 pro',{'fenix 9':'fēnix® 9','fenix':'fēnix'}),applySpelling('fēnix® 9 pro',{}));
  assert.equal(applySpelling('מאיר שליב ספר',{'מאיר שליב':'מאיר שליו'}),'מאיר שליו ספר');
  assert.equal(applySpelling('שליבי',{'שליב':'שליו'}),'שליבי');
});
