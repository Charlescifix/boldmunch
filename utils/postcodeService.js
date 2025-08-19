const axios = require('axios');

class PostcodeService {
  constructor() {
    this.baseUrl = 'https://api.postcodes.io';
  }

  // Validate and geocode a UK postcode
  async validateAndGeocode(postcode) {
    try {
      // Clean the postcode
      const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
      
      // Validate format (basic UK postcode pattern)
      const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/;
      if (!postcodeRegex.test(cleanPostcode)) {
        return {
          valid: false,
          error: 'Invalid UK postcode format'
        };
      }

      // Add space in correct position for API call
      const formattedPostcode = cleanPostcode.replace(/^(.+)([0-9][A-Z]{2})$/, '$1 $2');

      // Call postcodes.io API
      const response = await axios.get(`${this.baseUrl}/postcodes/${encodeURIComponent(formattedPostcode)}`);
      
      if (response.data.status === 200) {
        const result = response.data.result;
        
        return {
          valid: true,
          postcode: result.postcode,
          latitude: result.latitude,
          longitude: result.longitude,
          district: result.admin_district,
          ward: result.admin_ward,
          region: result.region,
          country: result.country,
          coordinates: [result.longitude, result.latitude] // [lng, lat] for GeoJSON
        };
      } else {
        return {
          valid: false,
          error: 'Postcode not found'
        };
      }
    } catch (error) {
      console.error('❌ Postcode validation error:', error.response?.data || error.message);
      
      if (error.response?.status === 404) {
        return {
          valid: false,
          error: 'Postcode not found'
        };
      }
      
      return {
        valid: false,
        error: 'Unable to validate postcode. Please try again.'
      };
    }
  }

  // Bulk validate multiple postcodes
  async validateMultiple(postcodes) {
    try {
      const cleanedPostcodes = postcodes.map(pc => 
        pc.replace(/\s+/g, '').toUpperCase().replace(/^(.+)([0-9][A-Z]{2})$/, '$1 $2')
      );

      const response = await axios.post(`${this.baseUrl}/postcodes`, {
        postcodes: cleanedPostcodes
      });

      return response.data.result.map((result, index) => ({
        input: postcodes[index],
        valid: result.result !== null,
        data: result.result,
        error: result.result === null ? 'Postcode not found' : null
      }));
    } catch (error) {
      console.error('❌ Bulk postcode validation error:', error);
      throw error;
    }
  }

  // Get nearby postcodes (useful for suggesting alternatives)
  async getNearbyPostcodes(postcode, limit = 10) {
    try {
      const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase().replace(/^(.+)([0-9][A-Z]{2})$/, '$1 $2');
      
      const response = await axios.get(`${this.baseUrl}/postcodes/${encodeURIComponent(cleanPostcode)}/nearest`);
      
      return response.data.result.slice(0, limit).map(pc => ({
        postcode: pc.postcode,
        distance: pc.distance,
        latitude: pc.latitude,
        longitude: pc.longitude,
        district: pc.admin_district
      }));
    } catch (error) {
      console.error('❌ Error finding nearby postcodes:', error);
      return [];
    }
  }

  // Calculate distance between two postcodes
  async calculateDistance(postcode1, postcode2) {
    try {
      const [location1, location2] = await Promise.all([
        this.validateAndGeocode(postcode1),
        this.validateAndGeocode(postcode2)
      ]);

      if (!location1.valid || !location2.valid) {
        throw new Error('One or both postcodes are invalid');
      }

      // Use Haversine formula to calculate distance
      const R = 6371; // Earth's radius in km
      const dLat = (location2.latitude - location1.latitude) * Math.PI / 180;
      const dLng = (location2.longitude - location1.longitude) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(location1.latitude * Math.PI / 180) * Math.cos(location2.latitude * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      return {
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        unit: 'km',
        from: location1,
        to: location2
      };
    } catch (error) {
      console.error('❌ Error calculating distance:', error);
      throw error;
    }
  }
}

module.exports = new PostcodeService();