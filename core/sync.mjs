export function validateSync(value={}) {
  const intervalMinutes=value.intervalMinutes??1440;
  if(!Number.isInteger(intervalMinutes)||intervalMinutes<15||intervalMinutes>10080)throw Error('תדירות עדכון צריכה להיות בין 15 ל־10080 דקות');
  return {enabled:value.enabled===true,autoActivate:value.autoActivate===true,intervalMinutes,nextAt:new Date(Date.now()+intervalMinutes*60000).toISOString()};
}
export function syncDue(project,now=Date.now()) {
  return project.sync?.enabled&&project.latestBuildId&&(!project.sync.nextAt||Date.parse(project.sync.nextAt)<=now);
}
