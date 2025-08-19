#!/usr/bin/env node

/**
 * Bold Munch Backend Setup Script
 * 
 * This script initializes the database and generates delivery zones.
 * Run this after setting up your environment variables.
 */

require('dotenv').config();
const { initializeDatabase } = require('./config/database');
const deliveryZones = require('./utils/deliveryZones');

async function setup() {
  console.log('🍞 Setting up Bold Munch backend...\n');
  
  try {
    // Check required environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'OPENROUTESERVICE_API_KEY',
      'WHATSAPP_NUMBER'
    ];
    
    const missing = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:');
      missing.forEach(varName => console.error(`   - ${varName}`));
      console.error('\nPlease check your .env file and try again.');
      process.exit(1);
    }
    
    console.log('✅ Environment variables verified');
    
    // Initialize database
    console.log('\n📦 Initializing database...');
    await initializeDatabase();
    
    // Generate delivery zones
    console.log('\n🚚 Generating delivery zones...');
    console.log('⏳ This may take a moment as we call the OpenRouteService API...');
    
    const zones = await deliveryZones.initializeDeliveryZones();
    
    console.log('\n✅ Setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Database tables created`);
    console.log(`   - Free delivery zone generated (7 minutes)`);
    console.log(`   - Paid delivery zone generated (15 minutes, £3 fee)`);
    console.log(`   - Hub location: ${process.env.HUB_POSTCODE || 'NN5 4YA'}`);
    console.log(`   - WhatsApp number: ${process.env.WHATSAPP_NUMBER}`);
    
    console.log('\n🚀 You can now start the server with: npm start');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    
    if (error.response?.status === 401) {
      console.error('\n💡 This looks like an OpenRouteService API key issue.');
      console.error('   Please check your OPENROUTESERVICE_API_KEY in the .env file.');
      console.error('   You can get a free API key at: https://openrouteservice.org/');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 This looks like a database connection issue.');
      console.error('   Please check your DATABASE_URL in the .env file.');
      console.error('   Make sure your Railway PostgreSQL instance is running.');
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Setup interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Setup terminated');
  process.exit(0);
});

// Run setup
setup();