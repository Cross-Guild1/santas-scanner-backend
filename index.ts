import express, { Express, Request, Response, NextFunction } from "express";
import mongoose from 'mongoose';
import cors from 'cors';
import { Question } from './types';
import { questions } from './data/questions';

// Vercel serverless config
const app: Express = express();
const port = process.env.PORT || 3000;

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    'https://santas-scanner-frontend.vercel.app',
    'https://santas-scanner-webappdeploy-production.up.railway.app',
    'http://localhost:3000',
    'https://santas-scanner-backenddeploy-production.up.railway.app'
  ]
  /*methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  //credentials: true,
  maxAge: 86400*/
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); 

// Database connection manager
let isConnected = false;
let cachedConnection: typeof mongoose | null = null;

const connectDB = async () => {
    if (isConnected) return;
  
    try {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined');
      }

      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000, // Longer timeout
        socketTimeoutMS: 45000,          // Longer timeout
        retryWrites: true,
        w: 'majority'
      });

      if (conn.connection.readyState !== 1) {
        throw new Error('MongoDB connection not ready');
      }

      isConnected = true;
      console.log(`MongoDB Connected: ${conn.connection.host}`);

    } catch (error) {
      console.error('MongoDB connection error:', error);
      process.exit(1);
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
    await connectDB();
    
    // Type-safe validation
    const requiredFields = ['name', 'verdict', 'message', 'score'];
    for (const field of requiredFields) {
      if (!(field in req.body)) {
        res.status(400).json({ error: `Missing ${field} field` });
        return;
      }
    }

    const scanResult = new ScanResult({
      ...req.body,
      score: Math.min(100, Math.max(0, req.body.score))
    });

    await scanResult.save();
    res.status(201).json(scanResult);
    
  } catch (error) {
    console.error('Scan result error:', error);
    res.status(500).json({ error: 'Failed to save result' });
  }
});

app.get("/leaderboard", async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('Connecting to database...');
      await connectDB();
      
      console.log('Fetching leaderboard...');
      const leaderboard = await ScanResult.find()
        .sort({ score: -1 })
        .limit(100)
        .lean();
        
      console.log(`Found ${leaderboard.length} results`);
      res.json(leaderboard);
      
    } catch (error) {
      console.error('Detailed leaderboard error:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve leaderboard',
        details: error instanceof Error ? error.message : String(error)
      });
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

// Vercel export
//export default app;



  