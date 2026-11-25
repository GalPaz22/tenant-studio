export const MARK='/* sauvignon-spelling */';
export function withSpelling(profile){
 const p=structuredClone(profile),h=p.hooks.transformProduct;
 if(h.code.includes(MARK))return p;
 const block=`  ${MARK}
  // כתיב אחיד: סוביניון → סובניון (בשם, בתיאור, בתגיות ובמפרט)
  {
    const fix = v => typeof v === 'string' ? v.replace(/סוביניון/g, 'סובניון')
      : Array.isArray(v) ? v.map(fix)
      : (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fix(x)]))
      : v;
    for (const k of ['title', 'name', 'description', 'tags', 'specifications']) if (product[k] != null) product[k] = fix(product[k]);
  }
`;
 const anchor='function transformProduct(product, ctx) {\n';
 if(!h.code.includes(anchor))throw Error('anchor not found');
 h.code=h.code.replace(anchor,anchor+block);
 h.note=(h.note||'')+' | כתיב סובניון';
 return p;
}
