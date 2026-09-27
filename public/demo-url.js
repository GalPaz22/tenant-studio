// Where a project's demo mirror opens. Locally it is its own host (<id>.demo.localhost:<port>) so the store is served
// at "/" — JavaScript storefronts route correctly and the store's code does not share the studio's origin. A remote
// studio (no wildcard host) keeps the /demo/<id> path.
export function demoUrl(id,path='/',mode=null){
 const local=['localhost','127.0.0.1'].includes(location.hostname);
 const p=(path.startsWith('/')?path:'/'+path)+(mode?(path.includes('?')?'&':'?')+'__semantix_mode='+mode:'');
 return local?`${location.protocol}//${id}.demo.localhost:${location.port}${p}`:`/demo/${id}${p}`;
}
