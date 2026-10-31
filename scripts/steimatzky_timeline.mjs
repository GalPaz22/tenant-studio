import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db('steimatzky');

  console.log('--- 1. DATE RANGES & ACTIVITY (LAST 30 DAYS) ---');
  const now = new Date('2026-10-21T13:30:00.000Z');
  const d30 = new Date(now.getTime() - 30 * 86400000);

  // Queries daily activity (timestamp is Date)
  const dailyQueries = await db.collection('queries').aggregate([
    { $match: { timestamp: { $gte: d30 } } },
    { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
        count: { $sum: 1 },
        sessions: { $addToSet: '$session_id' }
    }},
    { $project: { date: '$_id', count: 1, sessions: { $size: '$sessions' }, _id: 0 } },
    { $sort: { date: -1 } }
  ]).toArray();
  console.log('Daily Queries (Last 30 days):', dailyQueries);

  // Daily Clicks (timestamp is Date)
  const dailyClicks = await db.collection('product_clicks').aggregate([
    { $match: { timestamp: { $gte: d30 } } },
    { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
        count: { $sum: 1 },
        withQuery: { $sum: { $cond: [{ $ifNull: ['$search_query', false] }, 1, 0] } },
        sessions: { $addToSet: '$session_id' }
    }},
    { $project: { date: '$_id', count: 1, withQuery: 1, sessions: { $size: '$sessions' }, _id: 0 } },
    { $sort: { date: -1 } }
  ]).toArray();
  console.log('Daily Clicks (Last 30 days):', dailyClicks);

  // Daily Cart (timestamp is string)
  const dailyCart = await db.collection('cart').aggregate([
    { $match: { timestamp: { $gte: d30.toISOString() } } },
    { $group: {
        _id: { $substr: ['$timestamp', 0, 10] },
        count: { $sum: 1 },
        withQuery: { $sum: { $cond: [{ $ifNull: ['$search_query', false] }, 1, 0] } },
        sessions: { $addToSet: '$session_id' }
    }},
    { $project: { date: '$_id', count: 1, withQuery: 1, sessions: { $size: '$sessions' }, _id: 0 } },
    { $sort: { date: -1 } }
  ]).toArray();
  console.log('Daily Cart (Last 30 days):', dailyCart);

  await client.close();
}

main().catch(console.error);
