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
  const lng = parseFloat(process.env.HUB_LONGITUDE);
  const lat = parseFloat(process.env.HUB_LATITUDE);
  
  if (!lng || !lat) {
    throw new Error('Hub coordinates must be set in environment variables: HUB_LONGITUDE, HUB_LATITUDE');
  }
  
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
      const hubCoords = getHubCoordinates();
      
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
        }
      });

      return response.data;
    } catch (error) {
      console.error(`❌ Error generating ${timeMinutes}-minute isochrone:`, error.response?.data || error.message);
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
      const pointCoords = [longitude, latitude];
      
      // Get delivery zones from database
      const zones = await query(`
        SELECT name, polygon, delivery_fee, max_distance_minutes 
        FROM delivery_zones 
        ORDER BY delivery_fee ASC
      `);

      for (const zone of zones.rows) {
        if (isPointInPolygon(pointCoords, zone.polygon.coordinates)) {
          return {
            inDeliveryArea: true,
            deliveryFee: parseFloat(zone.delivery_fee),
            zoneName: zone.name,
            maxDistanceMinutes: zone.max_distance_minutes
          };
        }
      }

      // Point is outside all delivery zones - suggest making enquiry
      return {
        inDeliveryArea: false,
        deliveryFee: null,
        zoneName: 'Outside delivery area',
        maxDistanceMinutes: null,
        requiresEnquiry: true
      };
    } catch (error) {
      console.error('❌ Error calculating delivery fee:', error);
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
      const pointCoords = [longitude, latitude];
      const uptonPolygon = this.getUptonEstatePolygon().coordinates;
      
      return isPointInPolygon(pointCoords, uptonPolygon);
    } catch (error) {
      console.error('❌ Error checking Upton estate:', error);
      return false;
    }
  }
}

module.exports = new DeliveryZoneManager();