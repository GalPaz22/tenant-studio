import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 30000 });
  await client.connect();
  const db = client.db('steimatzky');

  const now = new Date('2026-10-21T13:30:00.000Z');
  const d30 = new Date(now.getTime() - 30 * 86400000);
  const d30Str = d30.toISOString();

  console.log('=== 1. OVERALL SEARCH CONVERSION BENCHMARKS (Last 30 Days) ===');
  // Distinct search sessions
  const searchSessions = await db.collection('queries').distinct('session_id', { timestamp: { $gte: d30 } });
  const totalSearchSessionsCount = searchSessions.length;

  // Search sessions that had at least one click
  const clickSessionsWithSearch = await db.collection('product_clicks').distinct('session_id', {
    timestamp: { $gte: d30 },
    search_query: { $nin: [null, '', 'null', 'undefined'] }
  });

  // Search sessions that had at least one cart addition
  const cartSessionsWithSearch = await db.collection('cart').distinct('session_id', {
    timestamp: { $gte: d30Str },
    search_query: { $nin: [null, '', 'null', 'undefined'] }
  });

  // Total cart sessions overall (including direct browse)
  const allCartSessions = await db.collection('cart').distinct('session_id', {
    timestamp: { $gte: d30Str }
  });

  console.log({
    totalSearchSessions: totalSearchSessionsCount,
    sessionsWithSearchClicks: clickSessionsWithSearch.length,
    sessionsWithSearchCart: cartSessionsWithSearch.length,
    overallSearchCTR: ((clickSessionsWithSearch.length / totalSearchSessionsCount) * 100).toFixed(2) + '%',
    overallSearchCVR: ((cartSessionsWithSearch.length / totalSearchSessionsCount) * 100).toFixed(2) + '%',
    overallSearchClickToCart: ((cartSessionsWithSearch.length / clickSessionsWithSearch.length) * 100).toFixed(2) + '%',
    totalCartSessionsAllSources: allCartSessions.length,
    searchCartShareOfAllCarts: ((cartSessionsWithSearch.length / allCartSessions.length) * 100).toFixed(2) + '%'
  });

  console.log('\n=== 2. TOP CLICKED PRODUCTS FROM SEARCH ===');
  const topClickedProducts = await db.collection('product_clicks').aggregate([
    { $match: { timestamp: { $gte: d30 }, search_query: { $nin: [null, '', 'null', 'undefined'] } } },
    { $group: {
        _id: { pid: '$product_id', name: '$product_name' },
        clicks: { $sum: 1 },
        sessions: { $addToSet: '$session_id' },
        queries: { $addToSet: '$search_query' }
    }},
    { $project: {
        pid: '$_id.pid',
        name: '$_id.name',
        clicks: 1,
        sessions: { $size: '$sessions' },
        queriesCount: { $size: '$queries' },
        topQueries: { $slice: ['$queries', 4] },
        _id: 0
    }},
    { $sort: { clicks: -1 } },
    { $limit: 20 }
  ]).toArray();
  console.table(topClickedProducts.map(p => ({
    pid: p.pid,
    name: p.name.slice(0, 35),
    clicks: p.clicks,
    sessions: p.sessions,
    queries: p.queriesCount,
    sampleQueries: p.topQueries.join(', ').slice(0, 40)
  })));

  console.log('\n=== 3. TOP ADD-TO-CART PRODUCTS FROM SEARCH ===');
  const topCartProducts = await db.collection('cart').aggregate([
    { $match: { timestamp: { $gte: d30Str }, search_query: { $nin: [null, '', 'null', 'undefined'] } } },
    { $group: {
        _id: { pid: '$product_id', name: '$product_name' },
        carts: { $sum: 1 },
        sessions: { $addToSet: '$session_id' },
        queries: { $addToSet: '$search_query' }
    }},
    { $project: {
        pid: '$_id.pid',
        name: '$_id.name',
        carts: 1,
        sessions: { $size: '$sessions' },
        queriesCount: { $size: '$queries' },
        topQueries: { $slice: ['$queries', 4] },
        _id: 0
    }},
    { $sort: { carts: -1 } },
    { $limit: 20 }
  ]).toArray();
  console.table(topCartProducts.map(p => ({
    pid: p.pid,
    name: p.name.slice(0, 35),
    carts: p.carts,
    sessions: p.sessions,
    queries: p.queriesCount,
    sampleQueries: p.topQueries.join(', ').slice(0, 40)
  })));

  console.log('\n=== 4. QUERY BEHAVIOR: LANGUAGE & STRUCTURE ===');
  // Sample 5,000 queries to analyze language, length, word count
  const sampleQueries = await db.collection('queries').aggregate([
    { $match: { timestamp: { $gte: d30 } } },
    { $project: { query: 1, deliveredCount: { $size: { $ifNull: ['$deliveredProducts', []] } } } },
    { $limit: 10000 }
  ]).toArray();

  let hebrewOnly = 0, englishOnly = 0, mixedOrOther = 0;
  let singleWord = 0, twoWords = 0, threeOrMoreWords = 0;
  let totalLength = 0;

  for (const q of sampleQueries) {
    const text = (q.query || '').trim();
    totalLength += text.length;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 1) singleWord++;
    else if (words.length === 2) twoWords++;
    else threeOrMoreWords++;

    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    const hasEnglish = /[a-zA-Z]/.test(text);
    if (hasHebrew && !hasEnglish) hebrewOnly++;
    else if (hasEnglish && !hasHebrew) englishOnly++;
    else mixedOrOther++;
  }

  console.log('Language Breakdown (Sample 10,000):', {
    Hebrew: ((hebrewOnly / sampleQueries.length) * 100).toFixed(1) + '%',
    English: ((englishOnly / sampleQueries.length) * 100).toFixed(1) + '%',
    MixedOrNumbers: ((mixedOrOther / sampleQueries.length) * 100).toFixed(1) + '%'
  });

  console.log('Word Count Breakdown:', {
    SingleWord: ((singleWord / sampleQueries.length) * 100).toFixed(1) + '%',
    TwoWords: ((twoWords / sampleQueries.length) * 100).toFixed(1) + '%',
    ThreeOrMoreWords: ((threeOrMoreWords / sampleQueries.length) * 100).toFixed(1) + '%',
    AvgCharLength: (totalLength / sampleQueries.length).toFixed(1)
  });

  await client.close();
}

main().catch(console.error);
