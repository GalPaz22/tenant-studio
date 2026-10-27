import {test} from 'node:test';import assert from 'node:assert/strict';
import {buildSearchIndex,createIndexRetriever} from './core/search-index.mjs';
// A query that names an author ranks that author's books first (Steimatzky, "חיים נבון", 2026-10-27).
const client={tenantId:'t',domain:'books',productTypes:{},colors:{},finishes:{},tagDefinitions:{},queryAliases:{},version:'1'};
const book=(id,title,description='',author='')=>({id,tenantId:'t',title,description,categories:[],tags:[],colors:[],finishes:[],stockStatus:'instock',hidden:false,price:80,specifications:author?{author}:{}});
test('a query naming an author puts that author\'s books first; one word must be the whole name',()=>{
 const products=[{...book('blurb','הצחוק','חיים של ילד נבון ושנון'),popularity:900},book('a1','חוה לא אכלה תפוח','','חיים נבון'),book('a2','תתיישנו','','ערך נבון חיים'),{...book('e1','עמנואל 3'),popularity:50},book('e2','יוגה','','עמנואל קארר')];
 const r=createIndexRetriever(products,client,buildSearchIndex(products,'1'));
 assert.deepEqual(r('חיים נבון').matches.map(p=>p.id).slice(0,2).sort(),['a1','a2']);assert.equal(r('חיים נבון').matches.at(-1).id,'blurb');
 assert.deepEqual(r('נבון חיים').matches.map(p=>p.id).slice(0,2).sort(),['a1','a2']);
 assert.equal(r('עמנואל').matches[0].id,'e1','a first name alone does not lift every author who has it');
});
