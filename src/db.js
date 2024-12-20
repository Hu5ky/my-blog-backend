import { MongoClient } from 'mongodb';

let db;

async function connectToDb(cb) {
    const client  = new MongoClient(`mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@myblogsite.eiop6.mongodb.net/?retryWrites=true&w=majority&appName=MyBlogSite`);
    await client.connect();
    db = client.db('react-blog-db');
    cb();
}

export {
    db, 
    connectToDb
};