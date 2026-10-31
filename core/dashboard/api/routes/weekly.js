import { weeklyState, weeklyQueries, requestWeeklyReview, reviewProposal, proposalMonitoring } from '../../weekly/service.js';
import { growthState, scanGrowth, configureGrowth } from '../../growth/service.js';
export async function weeklyRoutes(app){
 app.get('/optimization/search-growth',req=>growthState(req.customerStore));
 app.post('/optimization/search-growth/scan',req=>scanGrowth(req.customerStore));
 app.post('/optimization/search-growth/settings',req=>configureGrowth(req.customerStore,req.body?.enabled));
 app.get('/optimization/weekly-review',req=>weeklyState(req.customerStore));
 app.get('/optimization/weekly-review/queries',req=>weeklyQueries(req.customerStore,req.query));
 app.post('/optimization/weekly-review',req=>requestWeeklyReview(req.customerStore,req.body?.by));
 app.get('/proposals/:id/monitor',req=>proposalMonitoring(req.customerStore,req.params.id));
 for(const action of ['approve','test','reject','stop','promote'])app.post(`/proposals/:id/weekly/${action}`,req=>reviewProposal(req.customerStore,req.params.id,action,req.body?.by));
}
