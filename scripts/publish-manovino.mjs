import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {publishModule,readPublished} from '../core/module-publish.mjs';
const p=JSON.parse(await readFile(new URL('../data/2b3f29d3-1caf-4193-a527-d7da17bbae85.json',import.meta.url),'utf8'));
console.log('before',await readPublished(p,'manovino'));
const r=await publishModule(p,'manovino');console.log('published',r);
console.log('after',await readPublished(p,'manovino'));
