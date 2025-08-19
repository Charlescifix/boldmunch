const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { query } = require('../config/database');
const postcodeService = require('../utils/postcodeService');
const deliveryZones = require('../utils/deliveryZones');

// Validation schemas
const orderItemSchema = Joi.object({
  productId: Joi.string().required(),
  name: Joi.string().required().max(255),
  quantity: Joi.number().integer().min(1).required(),
  price: Joi.number().min(0).required(),
  size: Joi.string().optional(),
  variety: Joi.string().optional()
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

    // Calculate delivery fee
    const deliveryInfo = await deliveryZones.calculateDeliveryFee(
      postcodeResult.latitude,
      postcodeResult.longitude
    );

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
router.get('/:orderNumber', async (req, res) => {
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
router.patch('/:orderNumber/status', async (req, res) => {
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

// Get orders summary (admin endpoint)
router.get('/admin/summary', async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;

    let whereClause = '';
    let params = [parseInt(limit), parseInt(offset)];
    
    if (status) {
      whereClause = 'WHERE status = $3';
      params.push(status);
    }

    const result = await query(`
      SELECT 
        order_number, customer_name, postcode, status, 
        total, delivery_zone, created_at, whatsapp_sent
      FROM orders 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `, params);

    res.json({
      success: true,
      orders: result.rows.map(order => ({
        ...order,
        total: parseFloat(order.total)
      })),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rowCount
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

module.exports = router;