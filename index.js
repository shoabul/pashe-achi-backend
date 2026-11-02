import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log('Connected to MongoDB!');
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db(process.env.MONGODB_DB || 'pashe_achi_db');
const eventsCollection = db.collection('events');


const verifyAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).send({ error: 'Unauthorized. Please sign in.' });
  }

  req.userId = userId;
  next();
};


app.get('/', (req, res) => {
  res.send({ message: 'Server is running fine!' });
});


app.post('/api/events', verifyAuth, async (req, res) => {
  const { title, description, eventDate, location, eventType, thumbnailUrl } = req.body;

  if (!title || !eventDate) {
    return res.status(400).send({ error: 'Title and date are required.' });
  }

  const newEvent = {
    title,
    description: description || '',
    date: new Date(eventDate),
    location: location || '',
    category: eventType || 'General',
    thumbnailUrl: thumbnailUrl || '',
    createdBy: req.userId,
    createdAt: new Date(),
  };

  const result = await eventsCollection.insertOne(newEvent);
  res.send(result);
});


app.get('/api/events', async (req, res) => {
  const result = await eventsCollection.find().toArray();
  res.send(result);
});


app.get('/api/events/:id', async (req, res) => {
  const { id } = req.params;
  const result = await eventsCollection.findOne({ _id: new ObjectId(id) });
  res.send(result);
});


app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`);
});

export default app;