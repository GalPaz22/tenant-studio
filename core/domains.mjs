import {processGarmin} from '../tenants/garmin/index.mjs';
// Domain packs supply deterministic transformations; the runner stays generic.
const packs={'garmin.co.il':{name:'Garmin',processProduct:processGarmin}};
export function domainPack(project){const host=new URL(project.url).hostname.replace(/^www\./,'');return Object.hasOwn(packs,host)?packs[host]:null;}
