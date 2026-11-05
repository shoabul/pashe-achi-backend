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

// Create Event
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
    participants: [], // Tracks user IDs who joined this event
    createdAt: new Date(),
  };

  const result = await eventsCollection.insertOne(newEvent);
  res.send(result);
});

// Get Events (Supports filtering by createdBy or participant)
app.get('/api/events', async (req, res) => {
  try {
    const { createdBy, participant } = req.query;
    let query = {};
    
    if (createdBy) {
      query.createdBy = createdBy;
    }

    if (participant) {
      query.participants = participant;
    }

    const result = await eventsCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: 'Failed to fetch events.' });
  }
});

// Get Single Event by ID
app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: 'Invalid event ID.' });
    }
    const result = await eventsCollection.findOne({ _id: new ObjectId(id) });
    if (!result) {
      return res.status(404).send({ error: 'Event not found.' });
    }
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: 'Failed to fetch event.' });
  }
});

// Join / Leave Event Endpoint
app.post('/api/events/:id/join', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: 'Invalid event ID.' });
    }

    const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
    if (!event) {
      return res.status(404).send({ error: 'Event not found.' });
    }

    // Creator cannot join their own event
    if (event.createdBy === userId) {
      return res.status(400).send({ error: 'Creator cannot join their own event.' });
    }

    const participants = event.participants || [];
    const alreadyJoined = participants.includes(userId);

    let result;
    if (alreadyJoined) {
      // Leave event if already joined
      result = await eventsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $pull: { participants: userId } }
      );
      return res.send({ message: 'Successfully left the event.', joined: false });
    } else {
      // Join event if not joined yet
      result = await eventsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $addToSet: { participants: userId } }
      );
      return res.send({ message: 'Successfully joined the event.', joined: true });
    }
  } catch (error) {
    res.status(500).send({ error: 'Failed to process join request.' });
  }
});

// Update Event
app.put('/api/events/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, eventDate, location, eventType, thumbnailUrl } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: 'Invalid event ID.' });
    }

    const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
    if (!event) {
      return res.status(404).send({ error: 'Event not found.' });
    }
    if (event.createdBy !== req.userId) {
      return res.status(403).send({ error: 'Unauthorized to update this event.' });
    }

    const updatedData = {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(eventDate && { date: new Date(eventDate) }),
      ...(location !== undefined && { location }),
      ...(eventType && { category: eventType }),
      ...(thumbnailUrl !== undefined && { thumbnailUrl }),
      updatedAt: new Date(),
    };

    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: updatedData,
    };

    const result = await eventsCollection.updateOne(filter, updateDoc);

    res.send({ message: 'Event updated successfully', result });
  } catch (error) {
    res.status(500).send({ error: 'Failed to update event.' });
  }
});

// Delete Event
app.delete('/api/events/:id', verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: 'Invalid event ID.' });
    }

    const filter = { _id: new ObjectId(id) };

    const event = await eventsCollection.findOne(filter);
    if (!event) return res.status(404).send({ error: 'Event not found.' });
    if (event.createdBy !== req.userId) {
      return res.status(403).send({ error: 'Unauthorized to delete this event.' });
    }

    const result = await eventsCollection.deleteOne(filter);

    res.send({ message: 'Event deleted successfully', result });
  } catch (error) {
    res.status(500).send({ error: 'Failed to delete event.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`);
});

export default app;