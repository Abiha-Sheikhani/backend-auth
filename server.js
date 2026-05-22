require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');

const app = express();

// Connect Database
connectDB();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://your-production-domain.com'
    : ['http://localhost:5173', 'http://localhost:3001', 'http://localhost:5174'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running 🚀', timestamp: new Date() });
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
