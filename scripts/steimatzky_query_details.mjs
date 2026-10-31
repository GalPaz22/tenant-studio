import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const db = client.db('steimatzky');

  const testQueries = [
    'אליאס', 'לגו', 'lego', 'קטאן', 'דם רע', 'harry potter', 'kindle', 'קינדל',
    'verity', 'fourth wing', 'off campus', 'מחוץ לקמפוס', 'יומן', 'חולית', 'one piece'
  ];

  console.log('=== INSPECTING QUERY DELIVERED PRODUCTS VS CLICKS ===');
  for (const q of testQueries) {
    // Recent query doc
    const qDoc = await db.collection('queries').findOne(
      { query: new RegExp('^' + q + '$', 'i') },
      { sort: { timestamp: -1 } }
    );

    // Recent clicks for this query
    const clicks = await db.collection('product_clicks').aggregate([
      { $match: { search_query: new RegExp('^' + q + '$', 'i') } },
      { $group: {
          _id: { pid: '$product_id', name: '$product_name' },
          count: { $sum: 1 }
      }},
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray();

    // Recent carts for this query
    const carts = await db.collection('cart').aggregate([
      { $match: { search_query: new RegExp('^' + q + '$', 'i') } },
      { $group: {
          _id: { pid: '$product_id', name: '$product_name' },
          count: { $sum: 1 }
      }},
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray();

    console.log(`\n---------------- Query: "${q}" ----------------`);
    console.log('Sample Delivered Products:', qDoc?.deliveredProducts?.slice(0, 6) || 'None');
    console.log('Top Clicks:', clicks.map(c => `${c._id.name} (${c._id.pid}): ${c.count}`));
    console.log('Top Carts:', carts.map(c => `${c._id.name} (${c._id.pid}): ${c.count}`));
  }

  await client.close();
}

main().catch(console.error);
