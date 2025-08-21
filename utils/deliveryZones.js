const axios = require('axios');
const { query } = require('../config/database');

// Simple point-in-polygon function
function isPointInPolygon(point, polygon) {
  const [x, y] = point;
  const coords = polygon[0]; // First ring (exterior)
  
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const [xi, yi] = coords[i];
    const [xj, yj] = coords[j];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// Hub coordinates - loaded from environment for security
const getHubCoordinates = () => {
  console.log('🔧 Loading hub coordinates from environment...');
  const lng = parseFloat(process.env.HUB_LONGITUDE);
  const lat = parseFloat(process.env.HUB_LATITUDE);
  
  console.log(`📍 Hub coordinates check: lng=${lng}, lat=${lat}`);
  
  if (!lng || !lat || isNaN(lng) || isNaN(lat)) {
    const error = `Hub coordinates invalid or missing. HUB_LONGITUDE=${process.env.HUB_LONGITUDE}, HUB_LATITUDE=${process.env.HUB_LATITUDE}`;
    console.error('❌', error);
    throw new Error(error);
  }
  
  console.log('✅ Hub coordinates loaded successfully:', [lng, lat]);
  return [lng, lat]; // [longitude, latitude]
};

class DeliveryZoneManager {
  constructor() {
    this.apiKey = process.env.OPENROUTESERVICE_API_KEY;
    this.baseUrl = 'https://api.openrouteservice.org/v2/isochrones/driving-car';
  }

  // Generate isochrone polygon for given time in minutes
  async generateIsochrone(timeMinutes, profile = 'driving-car') {
    try {
      console.log(`🗺️  Generating ${timeMinutes}-minute isochrone...`);
      const hubCoords = getHubCoordinates();
      
      if (!this.apiKey) {
        throw new Error('OPENROUTESERVICE_API_KEY not configured');
      }
      
      console.log('📡 Calling OpenRouteService API...');
      const response = await axios.post(this.baseUrl, {
        locations: [hubCoords],
        range: [timeMinutes * 60], // Convert minutes to seconds
        range_type: 'time',
        attributes: ['area', 'reachfactor'],
        smoothing: 0.9
      }, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      console.log(`✅ Successfully generated ${timeMinutes}-minute isochrone`);
      return response.data;
    } catch (error) {
      const errorDetails = {
        timeMinutes,
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        apiResponse: error.response?.data,
        timeout: error.code === 'ECONNABORTED'
      };
      
      console.error(`❌ Error generating ${timeMinutes}-minute isochrone:`, errorDetails);
      
      if (error.response?.status === 401) {
        throw new Error('OpenRouteService API key is invalid or expired');
      }
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('OpenRouteService API timeout - service may be unavailable');
      }
      
      throw error;
    }
  }

  // Initialize delivery zones in database
  async initializeDeliveryZones() {
    try {
      console.log('🚚 Generating delivery zones...');

      // Generate 7-minute polygon (free delivery)
      const zone7min = await this.generateIsochrone(7);
      
      // Generate 15-minute polygon (£3 delivery)
      const zone15min = await this.generateIsochrone(15);

      // Clear existing zones
      await query('DELETE FROM delivery_zones');

      // Insert 7-minute zone (free delivery)
      await query(`
        INSERT INTO delivery_zones (name, polygon, delivery_fee, max_distance_minutes)
        VALUES ($1, $2, $3, $4)
      `, [
        'Free Delivery Zone',
        JSON.stringify(zone7min.features[0].geometry),
        0.00,
        7
      ]);

      // Insert 15-minute zone (£3 delivery)
      await query(`
        INSERT INTO delivery_zones (name, polygon, delivery_fee, max_distance_minutes)
        VALUES ($1, $2, $3, $4)
      `, [
        'Standard Delivery Zone',
        JSON.stringify(zone15min.features[0].geometry),
        3.00,
        15
      ]);

      console.log('✅ Delivery zones initialized successfully');
      
      return {
        freeZone: zone7min.features[0],
        paidZone: zone15min.features[0]
      };
    } catch (error) {
      console.error('❌ Error initializing delivery zones:', error);
      throw error;
    }
  }

  // Check if a point is within delivery area and calculate fee
  async calculateDeliveryFee(latitude, longitude) {
    try {
      console.log(`🔍 Calculating delivery fee for coordinates: [${longitude}, ${latitude}]`);
      const pointCoords = [longitude, latitude];
      
      // Get delivery zones from database
      console.log('📊 Querying delivery zones from database...');
      const zones = await query(`
        SELECT name, polygon, delivery_fee, max_distance_minutes 
        FROM delivery_zones 
        ORDER BY delivery_fee ASC
      `);

      console.log(`📋 Found ${zones.rows.length} delivery zones in database`);
      
      if (zones.rows.length === 0) {
        console.warn('⚠️  No delivery zones found in database! Need to initialize zones.');
        return {
          inDeliveryArea: false,
          deliveryFee: null,
          zoneName: 'Delivery zones not initialized',
          maxDistanceMinutes: null,
          requiresEnquiry: true,
          error: 'NO_ZONES_CONFIGURED'
        };
      }

      for (const zone of zones.rows) {
        console.log(`🧭 Checking if point is in zone: ${zone.name}`);
        if (isPointInPolygon(pointCoords, zone.polygon.coordinates)) {
          const result = {
            inDeliveryArea: true,
            deliveryFee: parseFloat(zone.delivery_fee),
            zoneName: zone.name,
            maxDistanceMinutes: zone.max_distance_minutes
          };
          console.log('✅ Point found in delivery zone:', result);
          return result;
        }
      }

      // Point is outside all delivery zones - suggest making enquiry
      console.log('📍 Point is outside all delivery zones');
      return {
        inDeliveryArea: false,
        deliveryFee: null,
        zoneName: 'Outside delivery area',
        maxDistanceMinutes: null,
        requiresEnquiry: true
      };
    } catch (error) {
      console.error('❌ Error calculating delivery fee:', {
        error: error.message,
        stack: error.stack,
        coordinates: [longitude, latitude]
      });
      throw error;
    }
  }

  // Get all delivery zones for frontend display
  async getDeliveryZones() {
    try {
      const result = await query(`
        SELECT name, polygon, delivery_fee, max_distance_minutes 
        FROM delivery_zones 
        ORDER BY delivery_fee ASC
      `);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error fetching delivery zones:', error);
      throw error;
    }
  }

  // Manual polygon for Upton estate (immediate area around hub for free delivery)
  getUptonEstatePolygon() {
    try {
      const hubCoords = getHubCoordinates();
      const [hubLng, hubLat] = hubCoords;
      
      // Create a small polygon around the hub (approximately 0.01 degrees radius)
      const offset = 0.005;
      
      return {
        type: 'Polygon',
        coordinates: [[
          [hubLng - offset, hubLat - offset], // Southwest corner
          [hubLng + offset, hubLat - offset], // Southeast corner  
          [hubLng + offset, hubLat + offset], // Northeast corner
          [hubLng - offset, hubLat + offset], // Northwest corner
          [hubLng - offset, hubLat - offset]  // Close polygon
        ]]
      };
    } catch (error) {
      console.error('❌ Error generating Upton estate polygon:', error);
      // Fallback to empty polygon if coordinates not available
      return {
        type: 'Polygon',
        coordinates: [[]]
      };
    }
  }

  // Check if address is in Upton estate for potential free delivery
  isInUptonEstate(latitude, longitude) {
    try {
      console.log(`🏘️  Checking if coordinates [${longitude}, ${latitude}] are in Upton Estate`);
      const pointCoords = [longitude, latitude];
      const uptonPolygon = this.getUptonEstatePolygon().coordinates;
      
      const isInUpton = isPointInPolygon(pointCoords, uptonPolygon);
      console.log(`🏘️  Upton Estate check result: ${isInUpton}`);
      
      return isInUpton;
    } catch (error) {
      console.error('❌ Error checking Upton estate:', {
        error: error.message,
        coordinates: [longitude, latitude]
      });
      return false;
    }
  }
}

module.exports = new DeliveryZoneManager();