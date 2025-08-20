const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { query } = require('../config/database');
const postcodeService = require('../utils/postcodeService');
const deliveryZones = require('../utils/deliveryZones');
const { verifyToken } = require('./auth');

// Validation schemas
const orderItemSchema = Joi.object({
  productId: Joi.string().required(),
  name: Joi.string().required().max(255),
  quantity: Joi.number().integer().min(1).required(),
  price: Joi.number().min(0).required(),
  size: Joi.string().allow(null, '').optional(),
  variety: Joi.string().allow(null, '').optional()
});

const createOrderSchema = Joi.object({
  customerName: Joi.string().required().trim().max(255),
  customerEmail: Joi.string().email().required().max(255),
  customerPhone: Joi.string().required().trim().max(20),
  deliveryAddress: Joi.string().required().trim().max(500),
  postcode: Joi.string().required().trim().max(10),
  items: Joi.array().items(orderItemSchema).min(1).required(),
  subtotal: Joi.number().min(0).required(),
  notes: Joi.string().optional().max(500)
});

// Generate unique order number
function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `BM${timestamp}${random}`;
}

// Create new order
router.post('/create', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = createOrderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order data',
        details: error.details[0].message
      });
    }

    const { 
      customerName, 
      customerEmail, 
      customerPhone, 
      deliveryAddress, 
      postcode, 
      items, 
      subtotal,
      notes = ''
    } = value;

    // Validate postcode and get coordinates
    const postcodeResult = await postcodeService.validateAndGeocode(postcode);
    if (!postcodeResult.valid) {
      return res.status(400).json({
        success: false,
        error: `Invalid postcode: ${postcodeResult.error}`
      });
    }

    // Check if in Upton estate first (same logic as frontend validation)
    const isInUpton = deliveryZones.isInUptonEstate(
      postcodeResult.latitude, 
      postcodeResult.longitude
    );

    let deliveryInfo;
    if (isInUpton) {
      deliveryInfo = {
        inDeliveryArea: true,
        deliveryFee: 0,
        zoneName: 'Upton Estate - Free Delivery',
        maxDistanceMinutes: 5,
        reason: 'Same estate delivery'
      };
    } else {
      // Calculate delivery fee using time-based polygons
      deliveryInfo = await deliveryZones.calculateDeliveryFee(
        postcodeResult.latitude,
        postcodeResult.longitude
      );
    }

    if (!deliveryInfo.inDeliveryArea) {
      return res.status(400).json({
        success: false,
        error: 'Sorry, we don\'t deliver to this postcode yet. Please contact us for special arrangements.',
        deliveryInfo
      });
    }

    // Calculate totals
    const deliveryFee = deliveryInfo.deliveryFee;
    const total = subtotal + deliveryFee;

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Insert order into database
    const orderResult = await query(`
      INSERT INTO orders (
        order_number, customer_name, customer_email, customer_phone,
        delivery_address, postcode, latitude, longitude, items,
        subtotal, delivery_fee, total, delivery_zone, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, order_number, created_at
    `, [
      orderNumber,
      customerName,
      customerEmail,
      customerPhone,
      deliveryAddress,
      postcodeResult.postcode,
      postcodeResult.latitude,
      postcodeResult.longitude,
      JSON.stringify(items),
      subtotal,
      deliveryFee,
      total,
      deliveryInfo.zoneName,
      'pending'
    ]);

    const order = orderResult.rows[0];

    // Return order confirmation
    res.status(201).json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        customerName,
        items,
        subtotal,
        deliveryFee,
        total,
        deliveryZone: deliveryInfo.zoneName,
        postcode: postcodeResult.postcode,
        estimatedDelivery: deliveryInfo.maxDistanceMinutes,
        createdAt: order.created_at
      },
      message: 'Order created successfully'
    });

  } catch (error) {
    console.error('❌ Order creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to create order. Please try again.'
    });
  }
});

// Get order by order number
router.get('/:orderNumber', verifyToken, async (req, res) => {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber || !orderNumber.startsWith('BM')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order number format'
      });
    }

    const result = await query(`
      SELECT * FROM orders WHERE order_number = $1
    `, [orderNumber]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = result.rows[0];
    
    res.json({
      success: true,
      order: {
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        deliveryAddress: order.delivery_address,
        postcode: order.postcode,
        items: order.items,
        subtotal: parseFloat(order.subtotal),
        deliveryFee: parseFloat(order.delivery_fee),
        total: parseFloat(order.total),
        deliveryZone: order.delivery_zone,
        status: order.status,
        whatsappSent: order.whatsapp_sent,
        createdAt: order.created_at,
        updatedAt: order.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Order retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to retrieve order'
    });
  }
});

// Update order status
router.patch('/:orderNumber/status', verifyToken, async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const result = await query(`
      UPDATE orders 
      SET status = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = $2
      RETURNING order_number, status, updated_at
    `, [status, orderNumber]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      order: result.rows[0],
      message: `Order status updated to ${status}`
    });

  } catch (error) {
    console.error('❌ Order status update error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to update order status'
    });
  }
});

// Mark WhatsApp as sent
router.patch('/:orderNumber/whatsapp-sent', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const result = await query(`
      UPDATE orders 
      SET whatsapp_sent = true, updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = $1
      RETURNING order_number, whatsapp_sent
    `, [orderNumber]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      order: result.rows[0],
      message: 'WhatsApp status updated'
    });

  } catch (error) {
    console.error('❌ WhatsApp status update error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to update WhatsApp status'
    });
  }
});

// Get orders summary (admin endpoint) - Optimized
router.get('/admin/summary', verifyToken, async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0, 
      status, 
      zone,
      dateFrom,
      dateTo 
    } = req.query;

    // Validate and sanitize inputs
    const limitInt = Math.min(parseInt(limit) || 50, 100); // Max 100 records
    const offsetInt = Math.max(parseInt(offset) || 0, 0);

    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    // Build dynamic WHERE clause
    if (status) {
      paramCount++;
      whereConditions.push(`status = $${paramCount}`);
      params.push(status);
    }

    if (zone) {
      paramCount++;
      whereConditions.push(`delivery_zone = $${paramCount}`);
      params.push(zone);
    }

    if (dateFrom) {
      paramCount++;
      whereConditions.push(`created_at >= $${paramCount}`);
      params.push(dateFrom);
    }

    if (dateTo) {
      paramCount++;
      whereConditions.push(`created_at <= $${paramCount}`);
      params.push(dateTo);
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // Add limit and offset parameters
    params.push(limitInt, offsetInt);

    // Optimized query with only necessary columns
    const ordersQuery = `
      SELECT 
        order_number, 
        customer_name, 
        postcode, 
        status, 
        total::numeric(10,2) as total,
        delivery_zone, 
        created_at, 
        whatsapp_sent
      FROM orders 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    // Get total count for pagination (optimized with same WHERE clause)
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM orders 
      ${whereClause}
    `;

    // Execute both queries in parallel
    const [ordersResult, countResult] = await Promise.all([
      query(ordersQuery, params),
      query(countQuery, params.slice(0, -2)) // Remove limit/offset for count
    ]);

    const totalCount = parseInt(countResult.rows[0].total_count);

    res.json({
      success: true,
      orders: ordersResult.rows,
      pagination: {
        limit: limitInt,
        offset: offsetInt,
        total: totalCount,
        pages: Math.ceil(totalCount / limitInt),
        hasNext: offsetInt + limitInt < totalCount,
        hasPrev: offsetInt > 0
      },
      summary: {
        totalOrders: totalCount,
        filters: { status, zone, dateFrom, dateTo }
      }
    });

  } catch (error) {
    console.error('❌ Orders summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to fetch orders summary'
    });
  }
});

// Get order analytics (admin endpoint) - New optimized endpoint
router.get('/admin/analytics', verifyToken, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    let dateCondition = '';
    switch (period) {
      case '24h':
        dateCondition = "created_at >= NOW() - INTERVAL '24 hours'";
        break;
      case '7d':
        dateCondition = "created_at >= NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        dateCondition = "created_at >= NOW() - INTERVAL '30 days'";
        break;
      default:
        dateCondition = "created_at >= NOW() - INTERVAL '7 days'";
    }

    // Use optimized analytics query
    const analyticsQuery = `
      SELECT 
        COUNT(*) as total_orders,
        SUM(total) as total_revenue,
        AVG(total) as avg_order_value,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN whatsapp_sent = false THEN 1 END) as pending_notifications
      FROM orders 
      WHERE ${dateCondition}
    `;

    // Zone breakdown query
    const zoneQuery = `
      SELECT 
        delivery_zone,
        COUNT(*) as order_count,
        SUM(total) as zone_revenue
      FROM orders 
      WHERE ${dateCondition}
      GROUP BY delivery_zone
      ORDER BY order_count DESC
    `;

    // Daily breakdown for charts
    const dailyQuery = `
      SELECT 
        DATE(created_at) as order_date,
        COUNT(*) as daily_orders,
        SUM(total) as daily_revenue
      FROM orders 
      WHERE ${dateCondition}
      GROUP BY DATE(created_at)
      ORDER BY order_date DESC
    `;

    const [analyticsResult, zoneResult, dailyResult] = await Promise.all([
      query(analyticsQuery),
      query(zoneQuery),
      query(dailyQuery)
    ]);

    res.json({
      success: true,
      period,
      analytics: {
        ...analyticsResult.rows[0],
        total_revenue: parseFloat(analyticsResult.rows[0].total_revenue || 0),
        avg_order_value: parseFloat(analyticsResult.rows[0].avg_order_value || 0)
      },
      zoneBreakdown: zoneResult.rows.map(row => ({
        ...row,
        zone_revenue: parseFloat(row.zone_revenue)
      })),
      dailyBreakdown: dailyResult.rows.map(row => ({
        ...row,
        daily_revenue: parseFloat(row.daily_revenue)
      }))
    });

  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to fetch analytics'
    });
  }
});

module.exports = router;