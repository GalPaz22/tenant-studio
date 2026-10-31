import { MongoClient } from 'mongodb';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not found');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db('steimatzky');

  const collections = ['queries', 'product_clicks', 'cart', 'zero_searches', 'semantix_steimatzky_sessions', 'semantix_module'];

  for (const name of collections) {
    const col = db.collection(name);
    const count = await col.estimatedDocumentCount();
    const sample = await col.find().sort({ _id: -1 }).limit(1).toArray();
    const oldest = await col.find().sort({ _id: 1 }).limit(1).toArray();
    console.log(`\n=================== Collection: ${name} (Count: ~${count}) ===================`);
    console.log('Oldest sample _id timestamp:', oldest[0]?._id?.getTimestamp?.());
    console.log('Newest sample _id timestamp:', sample[0]?._id?.getTimestamp?.());
    console.log('Sample document keys:', sample[0] ? Object.keys(sample[0]) : []);
    console.log('Sample doc:', JSON.stringify(sample[0], null, 2));
  }

  await client.close();
}

main().catch(console.error);
