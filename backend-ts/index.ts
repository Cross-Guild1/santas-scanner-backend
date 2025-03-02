import express, { Express, Request, Response, NextFunction } from "express";
import mongoose from 'mongoose';
import cors from 'cors';
import { Question } from './types';
import { questions } from './data/questions';

// Vercel serverless config
const app: Express = express();
const port = 4000;

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    'https://santas-scanner-frontend.vercel.app',
    'https://santas-scanner-webappdeploy-production.up.railway.app',
    'http://localhost:3000',
    'https://santas-scanner-backenddeploy-production.up.railway.app'
  ]
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); 

// Sample data for testing when DB is not available
const mockLeaderboard = [
  {
    name: "Test User 1",
    verdict: "NICE",
    message: "Very kind and helpful",
    score: 95,
    country: "DE",
    timestamp: new Date()
  },
  {
    name: "Test User 2",
    verdict: "NAUGHTY",
    message: "Needs to improve behavior",
    score: 45,
    country: "DE",
    timestamp: new Date()
  }
];

// Database connection manager
let isConnected = false;
let cachedConnection: typeof mongoose | null = null;

const connectDB = async () => {
    if (isConnected) return true;
  
    try {
      // For testing, you can use your MongoDB connection string
      // or a fallback empty string to trigger the error handling
      const mongoUri = 'mongodb+srv://philippkhachik:root@dev.42htl.mongodb.net/?retryWrites=true&w=majority&appName=dev';
      
      if (!mongoUri) {
        console.log('MongoDB URI not provided, using mock data');
        return false;
      }

      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000, // Shorter timeout for faster testing
        socketTimeoutMS: 10000,
        retryWrites: true,
        w: 'majority'
      });

      if (conn.connection.readyState !== 1) {
        console.log('MongoDB connection not in ready state, using mock data');
        return false;
      }

      isConnected = true;
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return true;

    } catch (error) {
      console.error('MongoDB connection error, using mock data:', error);
      return false;
    }
};

// Database schema with TypeScript interface
interface IScanResult extends mongoose.Document {
  name: string;
  verdict: 'NAUGHTY' | 'NICE';
  message: string;
  score: number;
  country?: string;
  timestamp: Date;
}

const scanResultSchema = new mongoose.Schema<IScanResult>({
  name: { type: String, required: true },
  verdict: { type: String, enum: ['NAUGHTY', 'NICE'], required: true },
  message: { type: String, required: true },
  score: { type: Number, min: 0, max: 100, required: true },
  country: String,
  timestamp: { type: Date, default: Date.now }
});

const ScanResult = mongoose.model<IScanResult>('ScanResult', scanResultSchema);

// Route handlers with proper typing
app.get("/questions", async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(questions);
  } catch (error) {
    console.error('Questions error:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

app.post("/scan-results", express.json(), async (req: Request, res: Response): Promise<void> => {
  try {
    const dbConnected = await connectDB();
    
    // Type-safe validation
    const requiredFields = ['name', 'verdict', 'message', 'score'];
    for (const field of requiredFields) {
      if (!(field in req.body)) {
        res.status(400).json({ error: `Missing ${field} field` });
        return;
      }
    }

    if (dbConnected) {
      // If database connected, save to MongoDB
      const scanResult = new ScanResult({
        ...req.body,
        score: Math.min(100, Math.max(0, req.body.score))
      });

      await scanResult.save();
      res.status(201).json(scanResult);
    } else {
      // Mock response for testing
      res.status(201).json({
        ...req.body,
        score: Math.min(100, Math.max(0, req.body.score)),
        _id: "mock-id-" + Date.now(),
        timestamp: new Date()
      });
    }
    
  } catch (error) {
    console.error('Scan result error:', error);
    res.status(500).json({ error: 'Failed to save result' });
  }
});

app.get("/leaderboard", async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('Connecting to database...');
      const dbConnected = await connectDB();
      
      if (dbConnected) {
        console.log('Fetching leaderboard from database...');
        const leaderboard = await ScanResult.find()
          .sort({ score: -1 })
          .limit(100)
          .lean();
          
        console.log(`Found ${leaderboard.length} results`);
        res.json(leaderboard);
      } else {
        // Use mock data for testing
        console.log('Using mock leaderboard data');
        res.json(mockLeaderboard);
      }
      
    } catch (error) {
      console.error('Detailed leaderboard error:', error);
      // Fallback to mock data on error
      console.log('Error occurred, using mock leaderboard data');
      res.json(mockLeaderboard);
    }
});

app.get("/country", async (req: Request, res: Response): Promise<void> => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode`);
    const data = await response.json();
    
    res.json({
      countryCode: data.status === 'success' ? data.countryCode : 'XX'
    });
  } catch (error) {
    console.error('Country error:', error);
    res.json({ countryCode: 'XX' });
  }
});

const server = app.listen(Number(port), '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});

