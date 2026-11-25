
export const MARK='/* salinity-tags */';
export function withSalinity(profile){
 const p=structuredClone(profile),h=p.hooks.transformProduct;
 if(h.code.includes(MARK))return p;
 const block=`
  ${MARK}
  // יין עם מליחות: תיאור הטעימה (עברית או אנגלית) מזכיר מליחות / סיומת מלוחה / salinity / salty
  {
    const text = [product.description || '', JSON.stringify(product.specifications || {})].join(' ');
    const isWine = tags.some(t => t === 'יין' || t.startsWith('יין ')) || url.includes('/wines/');
    if (isWine && !isCider && /מליח|מלוח|salin|salty|saltiness|\\bbriny\\b/i.test(text)) {
      for (const t of ['מלוח', 'מלוחה', 'מלוחים', 'מליחות', 'מליח', 'יין מלוח', 'יינות מלוחים', 'יין עם מליחות', 'סיומת מלוחה']) {
        if (!tags.includes(t)) tags.push(t);
      }
    }
  }
`;
 const i=h.code.lastIndexOf('  product.tags = tags;');
 if(i<0)throw Error('anchor not found');
 h.code=h.code.slice(0,i)+block.trimStart().replace(/^/,'  ')+'\n'+h.code.slice(i);
 h.note=(h.note||'')+' | תיוג מליחות ליינות';
 return p;
}
