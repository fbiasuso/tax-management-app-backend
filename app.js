import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { authenticate } from './middleware/auth.js';

// Import route files
import firmsRouter from './routes/firms.js';
import clientsRouter from './routes/clients.js';
import tasksRouter from './routes/tasks.js';
import modulesRouter from './routes/modules.js';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Test route
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Tax Management API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
// Public routes - no authentication required
app.use('/api/modules', modulesRouter);
app.use('/api/jurisdictions', modulesRouter); // jurisdictions endpoint is in modules.js

// Protected routes - authentication required
app.use('/api/firms', authenticate, firmsRouter);
app.use('/api/clients', authenticate, clientsRouter);
app.use('/api/tasks', authenticate, tasksRouter);

// 404 handler - CORREGIDO
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);

  // Determine error code and message
  let errorCode = 'INTERNAL_ERROR';
  let errorMessage = 'An unexpected error occurred';

  // If error already has a formatted response (from our middleware)
  if (err.error && err.message) {
    errorCode = err.error;
    errorMessage = err.message;
  }
  // If error has a status code and custom message
  else if (err.status && err.message) {
    errorCode = err.status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
    errorMessage = process.env.NODE_ENV === 'production' && err.status >= 500
      ? 'An unexpected error occurred'
      : err.message;
  }
  // Express validation error (Joi)
  else if (err.isJoi || err.name === 'ValidationError') {
    errorCode = 'VALIDATION_ERROR';
    errorMessage = err.details 
      ? err.details.map(d => d.message).join(', ') 
      : err.message;
  }
  // Database errors
  else if (err.code) {
    // PostgreSQL error codes
    if (err.code === '23505') { // unique_violation
      errorCode = 'DUPLICATE_ENTRY';
      errorMessage = 'A record with this value already exists';
    } else if (err.code === '23503') { // foreign_key_violation
      errorCode = 'INVALID_REFERENCE';
      errorMessage = 'Referenced record does not exist';
    } else {
      errorCode = 'DATABASE_ERROR';
      errorMessage = 'Database operation failed';
    }
  }

  // Determine HTTP status
  const status = err.status || 500;

  res.status(status).json({
    error: errorCode,
    message: errorMessage
  });
});

export default app;