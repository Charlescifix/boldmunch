const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { query } = require('../config/database');

// Validation schema
const whatsappRequestSchema = Joi.object({
  orderNumber: Joi.string().required().pattern(/^BM[A-Z0-9]+$/)
});

// Generate WhatsApp message and return redirect URL
router.post('/generate-message', async (req, res) => {
  try {
    // Validate request
    const { error, value } = whatsappRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order number format'
      });
    }

    const { orderNumber } = value;

    // Get order details from database
    const orderResult = await query(`
      SELECT * FROM orders WHERE order_number = $1
    `, [orderNumber]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];
    
    // Check if order is in valid state for WhatsApp
    if (order.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Cannot send WhatsApp for cancelled order'
      });
    }

    // Format items for WhatsApp message
    const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items);
    const itemsList = items.map(item => {
      let itemText = `- ${item.quantity}x ${item.name}`;
      if (item.size) {
        itemText += ` (${item.size})`;
      }
      if (item.variety) {
        itemText += ` - ${item.variety}`;
      }
      return itemText;
    }).join('\n');

    // Generate WhatsApp message
    const message = `Hi Bold Munch! 🍞

I'd like to place this order:

${itemsList}

📍 Delivery Address: ${order.delivery_address}, ${order.postcode}
🚚 Delivery Fee: £${parseFloat(order.delivery_fee).toFixed(2)}
💰 Order Total: £${parseFloat(order.total).toFixed(2)}

Order Number: ${order.order_number}

Please send account details for transfer.

Thank you! 😊`;

    // The WhatsApp number is kept server-side and not exposed to frontend
    const whatsappNumber = process.env.WHATSAPP_NUMBER;
    
    if (!whatsappNumber) {
      console.error('❌ WhatsApp number not configured');
      return res.status(500).json({
        success: false,
        error: 'WhatsApp service not available'
      });
    }

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodedMessage}`;

    // Mark WhatsApp as sent (optional tracking)
    await query(`
      UPDATE orders 
      SET whatsapp_sent = true, updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = $1
    `, [orderNumber]);

    res.json({
      success: true,
      whatsappUrl,
      message: 'WhatsApp message generated successfully',
      orderDetails: {
        orderNumber: order.order_number,
        customerName: order.customer_name,
        total: parseFloat(order.total),
        itemCount: items.length
      }
    });

  } catch (error) {
    console.error('❌ WhatsApp generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to generate WhatsApp message'
    });
  }
});

// Get WhatsApp status for an order
router.get('/status/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber || !orderNumber.startsWith('BM')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order number format'
      });
    }

    const result = await query(`
      SELECT order_number, whatsapp_sent, created_at, updated_at 
      FROM orders 
      WHERE order_number = $1
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
      orderNumber: order.order_number,
      whatsappSent: order.whatsapp_sent,
      timestamps: {
        created: order.created_at,
        updated: order.updated_at
      }
    });

  } catch (error) {
    console.error('❌ WhatsApp status error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to check WhatsApp status'
    });
  }
});

// Generate WhatsApp URL for enquiries (no order required)
router.post('/generate-enquiry', async (req, res) => {
  try {
    // Validate and sanitize input
    const { enquiryType, message } = req.body;
    
    if (!message || typeof message !== 'string' || message.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or missing message'
      });
    }
    
    // Sanitize message content
    const sanitizedMessage = message
      .replace(/[<>]/g, '') // Remove angle brackets
      .substring(0, 2000); // Limit length
    
    const whatsappNumber = process.env.WHATSAPP_NUMBER;
    
    if (!whatsappNumber) {
      console.error('❌ WhatsApp number not configured');
      return res.status(500).json({
        success: false,
        error: 'WhatsApp service not available'
      });
    }
    
    // Encode message for URL
    const encodedMessage = encodeURIComponent(sanitizedMessage);
    const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodedMessage}`;
    
    // Log enquiry for analytics (optional)
    console.log(`📞 WhatsApp enquiry: ${enquiryType || 'general'}`);
    
    res.json({
      success: true,
      whatsappUrl,
      message: 'WhatsApp URL generated successfully',
      enquiryType: enquiryType || 'general'
    });
    
  } catch (error) {
    console.error('❌ WhatsApp enquiry error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to generate WhatsApp URL'
    });
  }
});

// Health check for WhatsApp service
router.get('/health', (req, res) => {
  const whatsappConfigured = !!process.env.WHATSAPP_NUMBER;
  
  res.json({
    success: true,
    whatsappConfigured,
    service: 'WhatsApp Integration',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;