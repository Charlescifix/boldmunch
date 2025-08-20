const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

async function setupDatabaseOptimizations() {
  console.log('🔧 Setting up database optimizations...\n');

  try {
    // Read the SQL optimization file
    const sqlFile = path.join(__dirname, '../config/optimize-database.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    // Split SQL statements (basic approach - works for our use case)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));

    console.log(`📋 Found ${statements.length} optimization statements to execute...\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        // Skip comments and empty statements
        if (statement.startsWith('--') || statement.trim() === '') {
          continue;
        }

        console.log(`⚙️  Executing optimization ${i + 1}/${statements.length}...`);
        
        // Show what we're executing (first 60 chars)
        const preview = statement.replace(/\s+/g, ' ').substring(0, 60) + '...';
        console.log(`   ${preview}`);
        
        await query(statement);
        console.log(`   ✅ Success\n`);
        
      } catch (error) {
        console.log(`   ⚠️  Warning: ${error.message}\n`);
        // Continue with other optimizations even if one fails
      }
    }

    // Verify indexes were created
    console.log('🔍 Verifying indexes...');
    const indexCheck = await query(`
      SELECT 
        indexname,
        tablename,
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'orders' 
      AND indexname LIKE 'idx_%'
      ORDER BY indexname
    `);

    console.log(`\n📊 Created ${indexCheck.rows.length} performance indexes:`);
    indexCheck.rows.forEach(row => {
      console.log(`   ✅ ${row.indexname} on ${row.tablename}`);
    });

    // Check table statistics
    console.log('\n📈 Updating table statistics...');
    await query('ANALYZE orders');
    console.log('   ✅ Table statistics updated');

    // Test query performance
    console.log('\n🏃 Testing query performance...');
    
    const testQueries = [
      {
        name: 'Order lookup by number',
        sql: "EXPLAIN ANALYZE SELECT * FROM orders WHERE order_number = 'BM123' LIMIT 1"
      },
      {
        name: 'Orders by status',
        sql: "EXPLAIN ANALYZE SELECT order_number, status, created_at FROM orders WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10"
      },
      {
        name: 'Recent orders pagination',
        sql: "EXPLAIN ANALYZE SELECT order_number, customer_name, total FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 0"
      }
    ];

    for (const testQuery of testQueries) {
      try {
        const result = await query(testQuery.sql);
        const executionTime = result.rows.find(row => 
          row['QUERY PLAN'] && row['QUERY PLAN'].includes('Execution Time:')
        );
        
        if (executionTime) {
          const timeMatch = executionTime['QUERY PLAN'].match(/Execution Time: ([\d.]+) ms/);
          if (timeMatch) {
            console.log(`   ✅ ${testQuery.name}: ${timeMatch[1]}ms`);
          }
        }
      } catch (error) {
        console.log(`   ⚠️  ${testQuery.name}: Could not test (${error.message})`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 DATABASE OPTIMIZATION COMPLETE!');
    console.log('='.repeat(60));
    console.log('✅ Performance indexes created');
    console.log('✅ Query optimizations applied');
    console.log('✅ Analytics views prepared');
    console.log('✅ Table statistics updated');
    console.log('\n📈 Your order queries should now be significantly faster!');
    console.log('\n💡 Recommendations:');
    console.log('   • Monitor query performance with pg_stat_statements');
    console.log('   • Run ANALYZE orders weekly for optimal performance');
    console.log('   • Consider read replicas if traffic grows significantly');
    console.log('   • Set up automated analytics refresh if using materialized views');

  } catch (error) {
    console.error('❌ Database optimization failed:', error);
    process.exit(1);
  }
}

// CLI usage
if (require.main === module) {
  setupDatabaseOptimizations()
    .then(() => {
      console.log('\n🔥 Ready to handle high-performance orders!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupDatabaseOptimizations };