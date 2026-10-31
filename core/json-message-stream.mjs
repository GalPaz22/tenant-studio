// Decode only a JSON reply whose FIRST root field is "message". Tool arguments,
// notes and reasoning never become answer text. Incomplete escapes stay buffered.
export function messagePrefix(raw) {
 const prefix=/^\s*\{\s*"message"\s*:\s*"/.exec(raw);if(!prefix)return '';
 const body=raw.slice(prefix[0].length),match=/^(?:[^"\\\u0000-\u001f]|\\["\\/bfnrt]|\\u[0-9a-fA-F]{4})*/.exec(body);
 try{let value=JSON.parse('"'+match[0]+'"');if(/[\uD800-\uDBFF]$/.test(value))value=value.slice(0,-1);return value;}catch{return '';}
}
