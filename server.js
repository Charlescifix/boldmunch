const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://boldmunch.up.railway.app',
        'https://*.up.railway.app',
        process.env.FRONTEND_URL
      ].filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:3002', 'http://127.0.0.1:5500', 'http://127.0.0.1:8000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // Default: 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // Default: 100 requests per window
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files with caching headers
app.use(express.static('.', {
  maxAge: process.env.NODE_ENV === 'production' 
    ? process.env.STATIC_FILES_CACHE_PRODUCTION || '7d'
    : process.env.STATIC_FILES_CACHE_DEV || '1h',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      // Cache HTML files for shorter time to allow content updates
      res.setHeader('Cache-Control', `public, max-age=${process.env.HTML_CACHE_MAX_AGE || 3600}`); // Default: 1 hour
    } else if (path.match(/\.(js|css)$/)) {
      // Cache JS/CSS files longer
      res.setHeader('Cache-Control', `public, max-age=${process.env.JS_CSS_CACHE_MAX_AGE || 604800}`); // Default: 7 days
    } else if (path.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
      // Cache images for a long time
      res.setHeader('Cache-Control', `public, max-age=${process.env.IMAGES_CACHE_MAX_AGE || 2592000}`); // Default: 30 days
    } else if (path.match(/\.(woff|woff2|ttf|eot)$/)) {
      // Cache fonts for a very long time
      res.setHeader('Cache-Control', `public, max-age=${process.env.FONTS_CACHE_MAX_AGE || 31536000}`); // Default: 1 year
    }
  }
}));

// Import routes
const deliveryRoutes = require('./routes/delivery');
const orderRoutes = require('./routes/orders');
const whatsappRoutes = require('./routes/whatsapp');
const { router: authRoutes, verifyToken } = require('./routes/auth');

// API routes
app.use('/api/delivery', deliveryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// WhatsApp configuration endpoint
app.get('/api/config/whatsapp', (req, res) => {
  res.json({
    whatsappNumber: process.env.WHATSAPP_NUMBER || '+44xxxxxxxxxx'
  });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/home.html');
});

// Serve about page
app.get('/about', (req, res) => {
  res.sendFile(__dirname + '/about.html');
});

// Serve order page
app.get('/order', (req, res) => {
  res.sendFile(__dirname + '/order.html');
});

// Contact route - serves the contact page
app.get('/contact', (req, res) => {
  res.sendFile(__dirname + '/contact.html');
});

// Serve product info page (both with and without .html extension)
app.get('/product-info', (req, res) => {
  res.sendFile(__dirname + '/product-info.html');
});
app.get('/product-info.html', (req, res) => {
  res.sendFile(__dirname + '/product-info.html');
});

// Serve contact page (both with and without .html extension)  
app.get('/contact.html', (req, res) => {
  res.sendFile(__dirname + '/contact.html');
});

// Serve about page (both with and without .html extension)
app.get('/about.html', (req, res) => {
  res.sendFile(__dirname + '/about.html');
});

// Serve order page (both with and without .html extension)
app.get('/order.html', (req, res) => {
  res.sendFile(__dirname + '/order.html');
});

// Serve home page (both with and without .html extension)
app.get('/home.html', (req, res) => {
  res.sendFile(__dirname + '/home.html');
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/admin.html');
});

// 404 handler
app.use('*', (req, res) => {
  // If it's an API request, return JSON
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API route not found' });
  } else {
    // For page requests, redirect to home page
    res.redirect('/');
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`🍞 Bold Munch server running on port ${PORT}`);
  console.log(`📍 Hub location: ${process.env.HUB_POSTCODE || 'NN5 4YA'}`);
});