const express = require('express');
const router = express.Router();
const Joi = require('joi');
const postcodeService = require('../utils/postcodeService');
const deliveryZones = require('../utils/deliveryZones');

// Validation schemas
const postcodeSchema = Joi.object({
  postcode: Joi.string().required().trim().max(10)
});

// Validate postcode and calculate delivery fee
router.post('/validate-postcode', async (req, res) => {
  const startTime = Date.now();
  console.log(`🚚 [${new Date().toISOString()}] POST /validate-postcode - Request received:`, req.body);
  
  try {
    // Validate request body
    const { error, value } = postcodeSchema.validate(req.body);
    if (error) {
      console.warn('⚠️  Request validation failed:', error.details[0].message);
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.details[0].message
      });
    }

    const { postcode } = value;
    console.log(`🔍 Processing postcode validation for: '${postcode}'`);

    // Validate and geocode postcode
    const postcodeResult = await postcodeService.validateAndGeocode(postcode);
    
    if (!postcodeResult.valid) {
      console.log('❌ Postcode validation failed:', postcodeResult.error);
      return res.status(400).json({
        success: false,
        error: postcodeResult.error
      });
    }
    
    console.log('✅ Postcode validation successful, checking delivery zones...');

    // Calculate delivery fee using time-based polygons
    const deliveryInfo = await deliveryZones.calculateDeliveryFee(
      postcodeResult.latitude,
      postcodeResult.longitude
    );

    const response = {
      success: true,
      postcode: postcodeResult.postcode,
      coordinates: {
        latitude: postcodeResult.latitude,
        longitude: postcodeResult.longitude
      },
      location: {
        district: postcodeResult.district,
        ward: postcodeResult.ward,
        region: postcodeResult.region
      },
      delivery: deliveryInfo
    };
    
    const duration = Date.now() - startTime;
    console.log(`✅ Request completed (${duration}ms) - Delivery info:`, deliveryInfo);
    res.json(response);

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      requestBody: req.body,
      duration: `${duration}ms`
    };
    
    console.error(`❌ Delivery validation error (${duration}ms):`, errorDetails);
    res.status(500).json({
      success: false,
      error: 'Unable to validate delivery area. Please try again.',
      ...(process.env.NODE_ENV === 'development' && { debug: errorDetails })
    });
  }
});

// Get delivery zones (for map display)
router.get('/zones', async (req, res) => {
  const startTime = Date.now();
  console.log(`🗺️  [${new Date().toISOString()}] GET /zones - Delivery zones requested`);
  
  try {
    const zones = await deliveryZones.getDeliveryZones();
    
    if (zones.length === 0) {
      console.warn('⚠️  No delivery zones configured');
      return res.json({
        success: true,
        zones: [],
        warning: 'Delivery zones are calculated in real-time'
      });
    }
    
    const response = {
      success: true,
      zones: zones.map(zone => ({
        name: zone.name,
        deliveryFee: parseFloat(zone.delivery_fee),
        maxDistanceMinutes: zone.max_distance_minutes,
        // Don't send full polygon data to frontend for security
        hasPolygon: true
      }))
    };
    
    const duration = Date.now() - startTime;
    console.log(`✅ Delivery zones fetched (${duration}ms) - Found ${zones.length} zones`);
    
    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      duration: `${duration}ms`
    };
    
    console.error(`❌ Error fetching delivery zones (${duration}ms):`, errorDetails);
    res.status(500).json({
      success: false,
      error: 'Unable to fetch delivery zones',
      ...(process.env.NODE_ENV === 'development' && { debug: errorDetails })
    });
  }
});

// Get system status (replaces initialize-zones endpoint)
router.get('/status', async (req, res) => {
  const startTime = Date.now();
  console.log(`📊 [${new Date().toISOString()}] GET /status - System status requested`);
  
  try {
    const { freeMinutes, maxMinutes, standardFee } = require('../utils/deliveryZones').getDeliverySettings ? 
      require('../utils/deliveryZones').getDeliverySettings() : 
      { freeMinutes: 7, maxMinutes: 15, standardFee: 3.00 };
    
    const hubLng = parseFloat(process.env.HUB_LONGITUDE);
    const hubLat = parseFloat(process.env.HUB_LATITUDE);
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      system: {
        deliverySystem: 'Real-time Matrix API',
        hubCoordinates: [hubLng, hubLat],
        hubPostcode: process.env.HUB_POSTCODE,
        settings: {
          freeDeliveryMinutes: freeMinutes,
          maxDeliveryMinutes: maxMinutes,
          standardFee: standardFee
        },
        apiConfigured: !!apiKey,
        coordinatesConfigured: !!(hubLng && hubLat)
      },
      duration: `${duration}ms`
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error getting system status (${duration}ms):`, error);
    res.status(500).json({
      success: false,
      error: 'Unable to get system status',
      duration: `${duration}ms`
    });
  }
});

// Get delivery information for a specific postcode (GET version)
router.get('/check/:postcode', async (req, res) => {
  const startTime = Date.now();
  const postcode = req.params.postcode;
  
  console.log(`🚚 [${new Date().toISOString()}] GET /check/${postcode} - Request received`);
  
  try {
    if (!postcode || postcode.length < 5) {
      console.warn('⚠️  Invalid postcode parameter:', postcode);
      return res.status(400).json({
        success: false,
        error: 'Valid postcode required'
      });
    }

    // Use the same logic as the POST endpoint
    const postcodeResult = await postcodeService.validateAndGeocode(postcode);
    
    if (!postcodeResult.valid) {
      console.log('❌ Postcode validation failed:', postcodeResult.error);
      return res.status(400).json({
        success: false,
        error: postcodeResult.error
      });
    }

    const deliveryInfo = await deliveryZones.calculateDeliveryFee(
      postcodeResult.latitude,
      postcodeResult.longitude
    );

    const duration = Date.now() - startTime;
    console.log(`✅ GET request completed (${duration}ms) - Delivery info:`, deliveryInfo);
    
    res.json({
      success: true,
      postcode: postcodeResult.postcode,
      delivery: deliveryInfo
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      postcode: postcode,
      duration: `${duration}ms`
    };
    
    console.error(`❌ Delivery check error (${duration}ms):`, errorDetails);
    res.status(500).json({
      success: false,
      error: 'Unable to check delivery area',
      ...(process.env.NODE_ENV === 'development' && { debug: errorDetails })
    });
  }
});

module.exports = router;