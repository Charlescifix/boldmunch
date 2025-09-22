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
  const ukFee = parseFloat(process.env.DELIVERY_UK_FEE) || 5.00;

  console.log('🚚 Delivery settings:', { freeMinutes, maxMinutes, standardFee, ukFee });
  return { freeMinutes, maxMinutes, standardFee, ukFee };
};

// Helper function to determine if a postcode result is in England only (excluding Scotland, Wales, and Northern Ireland)
const isEligibleForUKDelivery = (postcodeData) => {
  if (!postcodeData || !postcodeData.country) {
    return false;
  }

  // Must be England only
  if (postcodeData.country !== 'England') {
    return false;
  }

  return true;
};

class DeliveryZoneManager {
  constructor() {
    this.apiKey = process.env.OPENROUTESERVICE_API_KEY;
  }


  // Calculate delivery fee using real-time Matrix API
  async calculateDeliveryFee(latitude, longitude, postcodeData = null) {
    try {
      console.log(`🔍 Calculating delivery fee for coordinates: [${longitude}, ${latitude}]`);
      
      const hubCoords = getHubCoordinates();
      const customerCoords = [longitude, latitude];
      const { freeMinutes, maxMinutes, standardFee, ukFee } = getDeliverySettings();

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
        // Check if location is eligible for UK delivery (England only, excluding Scotland, Wales, and Northern Ireland)
        if (postcodeData && isEligibleForUKDelivery(postcodeData)) {
          console.log(`🇬🇧 Outside ${maxMinutes}-minute local area but eligible for UK delivery (${durationMinutes} min drive)`);
          return {
            inDeliveryArea: true,
            deliveryFee: ukFee,
            zoneName: 'UK Delivery Zone',
            maxDistanceMinutes: null,
            actualDurationMinutes: durationMinutes,
            reason: `${durationMinutes} min drive (England delivery = £${ukFee})`
          };
        } else {
          console.log(`❌ Outside ${maxMinutes}-minute delivery area and not eligible for UK delivery (${durationMinutes} min drive)`);
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
      const { freeMinutes, maxMinutes, standardFee, ukFee } = getDeliverySettings();

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
        },
        {
          name: 'UK Delivery Zone',
          delivery_fee: ukFee,
          max_distance_minutes: null,
          description: `£${ukFee} delivery to England (excluding Scotland, Wales, Northern Ireland)`
        }
      ];
    } catch (error) {
      console.error('❌ Error fetching delivery zones:', error);
      throw error;
    }
  }

}

// Create instance and export with additional functions
const deliveryZoneManager = new DeliveryZoneManager();
deliveryZoneManager.getDeliverySettings = getDeliverySettings;

module.exports = deliveryZoneManager;