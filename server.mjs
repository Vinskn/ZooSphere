import 'dotenv/config';
import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import random from 'crypto-random-string'

const app = express();

// cors middleware
app.use(cors());
app.use(express.json());
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/upload', express.static(path.join(__dirname, 'upload')));


// strorage
const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        const { collectionName } = req.params;
        let folder;
        if (collectionName === 'animalData') {
            folder = 'upload/animalsImg';
        }
        else if (collectionName === 'frontNews') {
            folder = 'upload/newsImg';
        }
        callback(null, folder);
    },
    filename: (req, file, callback) => {
        callback(null, `${random({length: 4})} - ${file.originalname}`)
    }
});
const upload = multer({ storage })

// MongoDB connection
const client = new MongoClient(process.env.mongo_url)
let db;

const connection = async () => {
    try {
        await client.connect();
        db = client.db('ZooSphere');
        console.log('Connected to MongoDB');
    }
    catch (e) {
        console.error('Failed to connect to MongoDB:', e);
    }
}

// get
app.get('/api/data/:collectionName/:id?', async (req, res) => {
    try {
        const { collectionName, id } = req.params;
        const collection = db.collection(collectionName);
        let query;
        if (id) {
            // if (ObjectId.isValid(id)) {
            //     query = { _id: new ObjectId(id) }
            // }
            // else {
            //     query = { _id: id }
            // }
            query = {'additionalData.key': id}
            try {
                const data = await collection.find(query).toArray();
                if (data) {
                    return res.status(200).json(data);
                }
                else {
                    return res.status(404).json({ error: 'Data not found' });
                }
            } 
            catch (e) {
                return res.status(400).json({ error: 'Invalid ID format' });
            }
        }

        const data = await collection.find({}).toArray();
        res.json(data);
    }
    catch (e) {
        console.error('Failed to fetch data:', e);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
})

//post
app.post('/api/data/:collectionName', upload.single('image'), async (req, res) => {
    try {
        const { collectionName } = req.params;
        const collection = db.collection(collectionName);

        if (req.file) {
            const filePath = path.join(req.file.destination, req.file.filename);
            const additionalData = req.body;
            const data = {filePath, additionalData}
            await collection.insertOne(data);
            return res.status(201).json({ message: 'Image uploaded successfully', data });
        }
        const data = req.body;
        await collection.insertOne(data);
        res.status(201).json(data);
    }
    catch (e) {
        console.error('Failed to insert data:', e);
        res.status(500).json({ error: 'Failed to insert data' });
    }
})


// update (parsial data -> patch)
app.patch('/api/data/:collectionName/:id', async (req, res) => {
    const updateData = req.body;
    const { collectionName, id } = req.params;
    const collection = db.collection(collectionName)
    try {
        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        res.status(200).json({ message: 'Ticket updated successfully' });
    } 
    catch (e) {
        console.log(e);
    }
})


// run server
const port = process.env.port || 5000;
app.listen(port, async() => {
    console.log(`running on ${port}`);
    await connection(); // connect to MongoDB before starting the server
})