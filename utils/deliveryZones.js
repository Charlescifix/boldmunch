const axios = require('axios');

// Hub coordinates and delivery settings - loaded from environment for security
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

// Delivery time thresholds from environment
const getDeliverySettings = () => {
  const freeMinutes = parseInt(process.env.DELIVERY_FREE_MINUTES) || 7;
  const maxMinutes = parseInt(process.env.DELIVERY_MAX_MINUTES) || 15;
  const standardFee = parseFloat(process.env.DELIVERY_STANDARD_FEE) || 3.00;
  
  console.log('🚚 Delivery settings:', { freeMinutes, maxMinutes, standardFee });
  return { freeMinutes, maxMinutes, standardFee };
};

class DeliveryZoneManager {
  constructor() {
    this.apiKey = process.env.OPENROUTESERVICE_API_KEY;
  }


  // Calculate delivery fee using real-time Matrix API
  async calculateDeliveryFee(latitude, longitude) {
    try {
      console.log(`🔍 Calculating delivery fee for coordinates: [${longitude}, ${latitude}]`);
      
      const hubCoords = getHubCoordinates();
      const customerCoords = [longitude, latitude];
      const { freeMinutes, maxMinutes, standardFee } = getDeliverySettings();

      if (!this.apiKey) {
        throw new Error('OPENROUTESERVICE_API_KEY not configured');
      }

      console.log('🚗 Calculating real-time driving duration from hub...');
      const response = await axios.post(
        'https://api.openrouteservice.org/v2/matrix/driving-car',
        {
          locations: [hubCoords, customerCoords],
          metrics: ['duration']
        },
        {
          headers: {
            'Authorization': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const durationSeconds = response.data.durations[0][1];
      const durationMinutes = Math.round(durationSeconds / 60);

      console.log(`⏱️ Driving time from hub: ${durationMinutes} minutes`);

      // Apply delivery fee logic based on driving time
      if (durationMinutes <= freeMinutes) {
        console.log(`✅ Within ${freeMinutes}-minute free delivery zone`);
        return {
          inDeliveryArea: true,
          deliveryFee: 0,
          zoneName: 'Free Delivery Zone',
          maxDistanceMinutes: freeMinutes,
          actualDurationMinutes: durationMinutes,
          reason: `${durationMinutes} min drive (≤${freeMinutes} min = free)`
        };
      } else if (durationMinutes <= maxMinutes) {
        console.log(`✅ Within ${maxMinutes}-minute standard delivery zone`);
        return {
          inDeliveryArea: true,
          deliveryFee: standardFee,
          zoneName: 'Standard Delivery Zone',
          maxDistanceMinutes: maxMinutes,
          actualDurationMinutes: durationMinutes,
          reason: `${durationMinutes} min drive (${freeMinutes+1}-${maxMinutes} min = £${standardFee})`
        };
      } else {
        console.log(`❌ Outside ${maxMinutes}-minute delivery area (${durationMinutes} min drive)`);
        return {
          inDeliveryArea: false,
          deliveryFee: null,
          zoneName: 'Outside delivery area',
          maxDistanceMinutes: null,
          actualDurationMinutes: durationMinutes,
          requiresEnquiry: true,
          reason: `${durationMinutes} min drive (>${maxMinutes} min = outside area)`
        };
      }

    } catch (error) {
      console.error('❌ Error calculating delivery fee:', {
        error: error.message,
        stack: error.stack,
        coordinates: [longitude, latitude]
      });

      // Handle specific API errors
      if (error.response?.status === 401) {
        throw new Error('OpenRouteService API key is invalid or expired');
      }
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('OpenRouteService API timeout - service may be unavailable');
      }

      throw error;
    }
  }

  // Get delivery zone information for frontend display (no database needed)
  async getDeliveryZones() {
    try {
      const { freeMinutes, maxMinutes, standardFee } = getDeliverySettings();
      
      return [
        {
          name: 'Free Delivery Zone',
          delivery_fee: 0.00,
          max_distance_minutes: freeMinutes,
          description: `Free delivery within ${freeMinutes} minutes drive`
        },
        {
          name: 'Standard Delivery Zone',
          delivery_fee: standardFee,
          max_distance_minutes: maxMinutes,
          description: `£${standardFee} delivery within ${maxMinutes} minutes drive`
        }
      ];
    } catch (error) {
      console.error('❌ Error fetching delivery zones:', error);
      throw error;
    }
  }

}

module.exports = new DeliveryZoneManager();