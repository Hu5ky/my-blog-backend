import fs from  'fs';
import path from 'path';
import admin from 'firebase-admin';
import express from 'express';
import 'dotenv/config';
import { db, connectToDb } from './db.js'
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url)
const credentials = JSON.parse(
    fs.readFileSync('./credentials.json')
);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

admin.initializeApp({
    credential: admin.credential.cert(credentials)
});

const app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

app.use(express.json()); //Middleware to explicitly tell the server to use json
app.use(express.static(path.join(__dirname, '../build')));

app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'));
});

app.use(async (req, res, next) => {
    const { authtoken } = req.headers;

    if (authtoken) {
        try {
            req.user = await admin.auth().verifyIdToken(authtoken);
        } catch (e) {
            return res.sendStatus(400);
        }
    }
    req.user = req.user || {};
    next();
});

app.get('/api/articles/:name', async (req, res) => {
    const { name } = req.params;
    const { uid } = req.user;

    const article = await db.collection('articles').findOne({ name });

    if (article) {
        const upvoteIds = article.upvoteIds || []; //Default val empty array
        article.canUpvote = uid && !upvoteIds.includes(uid); //Exists and is not in upvoteIds
        res.json(article);
        console.log(article);
    } else {
        res.sendStatus(404);
        console.log('Article 404');
    }
});


app.get('/api/articles', async (req, res) => {
    const articles = await db.collection('articles').find().toArray();
    if (articles) {
        res.json(articles);
    } else {
        res.send('Error when fetching articles!')
    }
});

app.use((req, res, next) => {
    if (req.user) {
        next();
    } else {
        res.sendStatus(401);
    }
});

app.put('/api/articles/:name/upvote', async (req, res) => {
    const { name } = req.params;
    const { uid } = req.user;
    
    const article = await db.collection('articles').findOne({ name });

    if (article) {
        const upvoteIds = article.upvoteIds || []; //Default val empty array
        const canUpvote = uid && !upvoteIds.includes(uid); //Exists and is not in upvoteIds
        if (canUpvote) {
            await db.collection('articles').updateOne({ name }, { 
                $inc: { upvotes: 1 },
                $push: { upvoteIds: uid }
            });
        }

        const updatedArticle = await db.collection('articles').findOne({ name });
        res.json(updatedArticle);
    } else {
        res.send('This article doesn\'t exist');
    }
});

app.post('/api/articles/:name/comments', async(req, res) => {
    const { name }  = req.params;
    const { text } = req.body;
    const { email } = req.user;

    await db.collection('articles').updateOne({ name }, {
        $push: { comments: { postedBy: email, text }}
    });
    
    const article = await db.collection('articles').findOne({ name });

    if (article) {
        res.json(article);
    } else {
        res.send('That article doesn\'t exist')
    }
})

app.post('/api/articles/addArticles', async(req, res) => {
    
    for (var article of req.body) {
        console.log(article);
    }
    const options = { ordered: true };
    const result = await await db.collection('articles').insertMany(req.body, options);

    res.json(result);
})

app.delete('/api/articles/deleteArticles', async(req, res) => {
    
    const articleIds = req.body.article_ids.map(id => new mongoose.Types.ObjectId(id));
    const query = {'_id': {'$in': articleIds}};
    const response = await db.collection('articles').deleteMany(query);
    
    console.log("Deleted " + response.deletedCount + " documents");
    res.json(response);
})

app.delete('/api/articles/deleteAllArticles', async(req, res) => {
    
    const response = await db.collection('articles').deleteMany({});
    res.json(response);
})

const PORT  = process.env.PORT || 8000;

connectToDb(()=> {
    console.log('Successfully connected to database!');
    app.listen(PORT, () => {
        console.log('Server is listening on port ' + PORT);
    });
});