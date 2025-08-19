const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { 
    success: false, 
    error: 'Too many authentication attempts, please try again later.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const loginSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(6).max(128).required()
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token is required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

// Admin login endpoint
router.post('/login', authLimiter, async (req, res) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid username or password format'
      });
    }

    const { username, password } = value;

    // Check credentials against environment variables
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      console.error('❌ Admin credentials not configured');
      return res.status(500).json({
        success: false,
        error: 'Authentication service not available'
      });
    }

    // Verify username and password
    const usernameMatch = username === adminUsername;
    const passwordMatch = await bcrypt.compare(password, adminPassword);

    // If admin password is not hashed, compare directly (for development)
    const directPasswordMatch = password === adminPassword;

    if (!usernameMatch || !(passwordMatch || directPasswordMatch)) {
      // Log failed attempt
      console.log(`🚨 Failed admin login attempt from ${req.ip} at ${new Date().toISOString()}`);
      
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        username: adminUsername,
        role: 'admin',
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRE || '24h',
        issuer: 'bold-munch-admin'
      }
    );

    // Log successful login
    console.log(`✅ Admin login successful from ${req.ip} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      token,
      message: 'Login successful',
      expiresIn: process.env.JWT_EXPIRE || '24h'
    });

  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
});

// Verify token endpoint
router.post('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    res.json({
      success: true,
      valid: true,
      user: {
        username: decoded.username,
        role: decoded.role
      },
      expiresAt: decoded.exp
    });
    
  } catch (error) {
    res.status(403).json({
      success: false,
      valid: false,
      error: 'Invalid or expired token'
    });
  }
});

// Logout endpoint (optional - just client-side token removal)
router.post('/logout', verifyToken, (req, res) => {
  // Log logout
  console.log(`🔓 Admin logout: ${req.user.username} at ${new Date().toISOString()}`);
  
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Protected route example
router.get('/profile', verifyToken, (req, res) => {
  res.json({
    success: true,
    user: {
      username: req.user.username,
      role: req.user.role
    },
    loginTime: new Date(req.user.iat * 1000).toISOString()
  });
});

// Health check
router.get('/health', (req, res) => {
  const jwtConfigured = !!process.env.JWT_SECRET;
  const adminConfigured = !!(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD);
  
  res.json({
    success: true,
    service: 'Authentication',
    jwtConfigured,
    adminConfigured,
    timestamp: new Date().toISOString()
  });
});

// Export middleware and router
module.exports = {
  router,
  verifyToken
};