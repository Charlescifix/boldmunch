const bcrypt = require('bcryptjs');

/**
 * Utility to generate hashed passwords for admin accounts
 * Run: node utils/hashPassword.js your-password
 */

if (process.argv.length < 3) {
  console.log('Usage: node utils/hashPassword.js <password>');
  console.log('Example: node utils/hashPassword.js mySecurePassword123');
  process.exit(1);
}

const password = process.argv[2];

if (password.length < 8) {
  console.log('❌ Password should be at least 8 characters long');
  process.exit(1);
}

async function hashPassword(plainPassword) {
  try {
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    
    console.log('✅ Password hashed successfully!');
    console.log('\nAdd this to your .env file:');
    console.log(`ADMIN_PASSWORD=${hashedPassword}`);
    console.log('\nFor development, you can also use the plain password:');
    console.log(`ADMIN_PASSWORD=${plainPassword}`);
    console.log('\n⚠️  IMPORTANT: Always use hashed passwords in production!');
    
  } catch (error) {
    console.error('❌ Error hashing password:', error);
    process.exit(1);
  }
}

hashPassword(password);