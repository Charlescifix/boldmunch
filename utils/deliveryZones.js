const axios = require('axios');
const turf = require('@turf/turf');
const { query } = require('../config/database');

// Hub coordinates for NN5 4YA (Upton) - updated to match actual postcode lookup
const HUB_COORDINATES = [-0.950749, 52.229993]; // [longitude, latitude]

class DeliveryZoneManager {
  constructor() {
    this.apiKey = process.env.OPENROUTESERVICE_API_KEY;
    this.baseUrl = 'https://api.openrouteservice.org/v2/isochrones/driving-car';
  }

  // Generate isochrone polygon for given time in minutes
  async generateIsochrone(timeMinutes, profile = 'driving-car') {
    try {
      const response = await axios.post(this.baseUrl, {
        locations: [HUB_COORDINATES],
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
      const point = turf.point([longitude, latitude]);
      
      // Get delivery zones from database
      const zones = await query(`
        SELECT name, polygon, delivery_fee, max_distance_minutes 
        FROM delivery_zones 
        ORDER BY delivery_fee ASC
      `);

      for (const zone of zones.rows) {
        const polygon = turf.polygon(zone.polygon.coordinates);
        
        if (turf.booleanPointInPolygon(point, polygon)) {
          return {
            inDeliveryArea: true,
            deliveryFee: parseFloat(zone.delivery_fee),
            zoneName: zone.name,
            maxDistanceMinutes: zone.max_distance_minutes
          };
        }
      }

      // Point is outside all delivery zones
      return {
        inDeliveryArea: false,
        deliveryFee: null,
        zoneName: 'Outside delivery area',
        maxDistanceMinutes: null
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
    // Polygon around NN5 4YA for local free delivery
    return {
      type: 'Polygon',
      coordinates: [[
        [-0.955, 52.225], // Southwest corner
        [-0.945, 52.225], // Southeast corner  
        [-0.945, 52.235], // Northeast corner
        [-0.955, 52.235], // Northwest corner
        [-0.955, 52.225]  // Close polygon
      ]]
    };
  }

  // Check if address is in Upton estate for potential free delivery
  isInUptonEstate(latitude, longitude) {
    try {
      const point = turf.point([longitude, latitude]);
      const uptonPolygon = turf.polygon(this.getUptonEstatePolygon().coordinates);
      
      return turf.booleanPointInPolygon(point, uptonPolygon);
    } catch (error) {
      console.error('❌ Error checking Upton estate:', error);
      return false;
    }
  }
}

module.exports = new DeliveryZoneManager();