import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { errorHandler } from './middlewares/errorHandler.middleware';
import { generalLimiter } from './middlewares/rateLimiter.middleware';
import routes from './routes';

config();

const app = express();

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'https://non-geo-qr-atten.lovable.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Apply global rate limiting
app.use(generalLimiter);

// Routes
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

export default app;
