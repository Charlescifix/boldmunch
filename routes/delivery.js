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
  try {
    // Validate request body
    const { error, value } = postcodeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.details[0].message
      });
    }

    const { postcode } = value;

    // Validate and geocode postcode
    const postcodeResult = await postcodeService.validateAndGeocode(postcode);
    
    if (!postcodeResult.valid) {
      return res.status(400).json({
        success: false,
        error: postcodeResult.error
      });
    }

    // Check if in Upton estate first (optional free delivery for same estate)
    const isInUpton = deliveryZones.isInUptonEstate(
      postcodeResult.latitude, 
      postcodeResult.longitude
    );

    console.log(`🔍 Upton check for ${postcodeResult.postcode}:`, {
      coordinates: [postcodeResult.longitude, postcodeResult.latitude],
      isInUpton
    });

    if (isInUpton) {
      return res.json({
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
        delivery: {
          inDeliveryArea: true,
          deliveryFee: 0,
          zoneName: 'Upton Estate - Free Delivery',
          maxDistanceMinutes: 5,
          reason: 'Same estate delivery'
        }
      });
    }

    // Calculate delivery fee using time-based polygons
    const deliveryInfo = await deliveryZones.calculateDeliveryFee(
      postcodeResult.latitude,
      postcodeResult.longitude
    );

    res.json({
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
    });

  } catch (error) {
    console.error('❌ Delivery validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to validate delivery area. Please try again.'
    });
  }
});

// Get delivery zones (for map display)
router.get('/zones', async (req, res) => {
  try {
    const zones = await deliveryZones.getDeliveryZones();
    res.json({
      success: true,
      zones: zones.map(zone => ({
        name: zone.name,
        deliveryFee: parseFloat(zone.delivery_fee),
        maxDistanceMinutes: zone.max_distance_minutes,
        // Don't send full polygon data to frontend for security
        hasPolygon: true
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching delivery zones:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to fetch delivery zones'
    });
  }
});

// Initialize delivery zones (admin endpoint)
router.post('/initialize-zones', async (req, res) => {
  try {
    // This should be protected in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Endpoint not available in production'
      });
    }

    const zones = await deliveryZones.initializeDeliveryZones();
    res.json({
      success: true,
      message: 'Delivery zones initialized successfully',
      zones
    });
  } catch (error) {
    console.error('❌ Error initializing delivery zones:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize delivery zones'
    });
  }
});

// Get delivery information for a specific postcode (GET version)
router.get('/check/:postcode', async (req, res) => {
  try {
    const postcode = req.params.postcode;
    
    if (!postcode || postcode.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Valid postcode required'
      });
    }

    // Use the same logic as the POST endpoint
    const postcodeResult = await postcodeService.validateAndGeocode(postcode);
    
    if (!postcodeResult.valid) {
      return res.status(400).json({
        success: false,
        error: postcodeResult.error
      });
    }

    const deliveryInfo = await deliveryZones.calculateDeliveryFee(
      postcodeResult.latitude,
      postcodeResult.longitude
    );

    res.json({
      success: true,
      postcode: postcodeResult.postcode,
      delivery: deliveryInfo
    });

  } catch (error) {
    console.error('❌ Delivery check error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to check delivery area'
    });
  }
});

module.exports = router;