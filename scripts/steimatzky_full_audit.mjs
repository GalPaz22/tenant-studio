import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 30000 });
  await client.connect();
  const db = client.db('steimatzky');

  console.log('--- STARTING COMPREHENSIVE STEIMATZKY AUDIT ---');
  // Analyze last 30 days (from Sep 21 to Oct 21, 2026)
  const now = new Date('2026-10-21T13:30:00.000Z');
  const d30 = new Date(now.getTime() - 30 * 86400000);
  const d30Str = d30.toISOString();

  // 1. Total volumes in last 30 days
  const totalQueries = await db.collection('queries').countDocuments({ timestamp: { $gte: d30 } });
  const totalClicks = await db.collection('product_clicks').countDocuments({ timestamp: { $gte: d30 } });
  const totalSearchClicks = await db.collection('product_clicks').countDocuments({ timestamp: { $gte: d30 }, search_query: { $nin: [null, '', 'null', 'undefined'] } });
  const totalCarts = await db.collection('cart').countDocuments({ timestamp: { $gte: d30Str } });
  const totalSearchCarts = await db.collection('cart').countDocuments({ timestamp: { $gte: d30Str }, search_query: { $nin: [null, '', 'null', 'undefined'] } });

  console.log('\n--- 1. OVERALL VOLUMES (Last 30 Days) ---');
  console.log({
    totalQueries,
    totalClicks,
    totalSearchClicks,
    totalCarts,
    totalSearchCarts,
    percentClicksFromSearch: ((totalSearchClicks / totalClicks) * 100).toFixed(1) + '%',
    percentCartsFromSearch: ((totalSearchCarts / totalCarts) * 100).toFixed(1) + '%'
  });

  // 2. Query funnel & CTR / CVR estimation
  // Let's sample or aggregate top queries
  console.log('\n--- 2. TOP 50 QUERIES BY FREQUENCY ---');
  const topQueries = await db.collection('queries').aggregate([
    { $match: { timestamp: { $gte: d30 } } },
    { $group: {
        _id: { $trim: { input: { $toLower: "$query" } } },
        count: { $sum: 1 },
        sessions: { $addToSet: '$session_id' },
        zeroResults: { $sum: { $cond: [
          { $or: [
            { $eq: ['$zero_results', true] },
            { $eq: [{ $size: { $ifNull: ['$deliveredProducts', []] } }, 0] }
          ]}, 1, 0
        ]}},
        avgDelivered: { $avg: { $size: { $ifNull: ['$deliveredProducts', []] } } }
    }},
    { $project: {
        query: '$_id',
        count: 1,
        sessions: { $size: '$sessions' },
        zeroResults: 1,
        avgDelivered: { $round: ['$avgDelivered', 1] },
        _id: 0
    }},
    { $sort: { count: -1 } },
    { $limit: 60 }
  ]).toArray();

  console.log('Top 60 Queries:');
  console.table(topQueries.slice(0, 30));

  // Let's get clicks and carts for these top queries
  const topQueryNames = topQueries.map(q => q.query);
  
  const queryClicksMap = new Map();
  const clicksForTop = await db.collection('product_clicks').aggregate([
    { $match: { 
        timestamp: { $gte: d30 },
        search_query: { $in: topQueryNames }
    }},
    { $group: {
        _id: '$search_query',
        clicks: { $sum: 1 },
        clickSessions: { $addToSet: '$session_id' },
        products: { $addToSet: '$product_name' }
    }}
  ]).toArray();
  for (const c of clicksForTop) {
    queryClicksMap.set(c._id, { clicks: c.clicks, sessions: c.clickSessions.length, productsCount: c.products.length });
  }

  const queryCartsMap = new Map();
  const cartsForTop = await db.collection('cart').aggregate([
    { $match: { 
        timestamp: { $gte: d30Str },
        search_query: { $in: topQueryNames }
    }},
    { $group: {
        _id: '$search_query',
        carts: { $sum: 1 },
        cartSessions: { $addToSet: '$session_id' }
    }}
  ]).toArray();
  for (const c of cartsForTop) {
    queryCartsMap.set(c._id, { carts: c.carts, sessions: c.cartSessions.length });
  }

  const enrichedTop = topQueries.map(q => {
    const clk = queryClicksMap.get(q.query) || { clicks: 0, sessions: 0, productsCount: 0 };
    const crt = queryCartsMap.get(q.query) || { carts: 0, sessions: 0 };
    const ctr = q.sessions > 0 ? ((clk.sessions / q.sessions) * 100).toFixed(1) + '%' : '0%';
    const cvr = q.sessions > 0 ? ((crt.sessions / q.sessions) * 100).toFixed(1) + '%' : '0%';
    const clickToCart = clk.sessions > 0 ? ((crt.sessions / clk.sessions) * 100).toFixed(1) + '%' : '0%';
    return {
      query: q.query,
      searches: q.count,
      searchSessions: q.sessions,
      clicks: clk.clicks,
      clickSessions: clk.sessions,
      carts: crt.carts,
      cartSessions: crt.sessions,
      CTR: ctr,
      CVR: cvr,
      ClickToCart: clickToCart,
      avgDelivered: q.avgDelivered,
      zeroResults: q.zeroResults
    };
  });

  console.log('\n--- TOP 30 ENRICHED FUNNEL ---');
  console.table(enrichedTop.slice(0, 30));

  // 3. ZERO RESULTS ANALYSIS
  console.log('\n--- 3. TOP ZERO RESULTS SEARCHES ---');
  const zeroSearches = await db.collection('zero_searches').aggregate([
    { $group: {
        _id: { $trim: { input: { $toLower: "$query" } } },
        hits: { $sum: "$hits" },
        sessions: { $addToSet: '$session_id' },
        lastSeen: { $max: '$last_seen' }
    }},
    { $project: {
        query: '$_id',
        hits: 1,
        sessions: { $size: '$sessions' },
        lastSeen: 1,
        _id: 0
    }},
    { $sort: { hits: -1 } },
    { $limit: 40 }
  ]).toArray();
  console.table(zeroSearches);

  await client.close();
}

main().catch(console.error);
