# 🍞 Bold Munch - Premium Bakery Ordering Platform

**Repository**: https://github.com/Charlescifix/boldmunch.git

A premium bakery ordering platform specializing in handmade banana breads, meat pies, and Nigerian puff puff. Built with modern web technologies and optimized for mobile-first experiences.

## 🎯 Features

- **Interactive Menu**: Browse handmade bakery items with detailed descriptions
- **Smart Ordering System**: Add items to cart with size and variety options
- **Real-time Delivery Validation**: Postcode-based delivery zone checking
- **WhatsApp Integration**: Seamless order confirmation via WhatsApp
- **Admin Dashboard**: Comprehensive order management and analytics
- **Responsive Design**: Optimized for mobile, tablet, and desktop with proper touch targets
- **Accessibility Compliant**: WCAG 2.1 Level AA compliant touch targets (44px minimum)
- **Premium UI/UX**: Glass morphism design with smooth animations

## 🚀 Technology Stack

### Backend
- **Runtime**: Node.js v22+
- **Framework**: Express.js
- **Database**: SQLite with migration support
- **Geospatial**: Native point-in-polygon validation (optimized, no external dependencies)
- **Communication**: WhatsApp Business API integration

### Frontend
- **Core**: Vanilla JavaScript (ES6+)
- **Styling**: Pure CSS with CSS Grid and Flexbox
- **Design**: Glass morphism with accessibility-first approach
- **Icons**: SVG-based icon system
- **Performance**: Optimized images and minimal dependencies

## 📱 Responsive Design & Accessibility

### Breakpoint System ✨ **NEWLY OPTIMIZED**
- **Mobile**: ≤768px - Single column layout, touch-optimized
- **Tablet**: 769px-1024px - Two-column grid, enhanced spacing *(NEW)*
- **Desktop**: ≥1025px - Full grid layout, hover effects

### Touch Target Standards ✨ **NEWLY IMPLEMENTED**
- **Minimum Size**: 44px × 44px (WCAG 2.1 Level AA compliant)
- **Interactive Elements**: All buttons, links, and controls meet accessibility standards
- **Spacing**: Adequate spacing between touch targets for error prevention

## 🛡️ Security Features

- Right-click context menu disabled
- Developer tools shortcuts blocked
- Image drag protection
- Text selection prevention on sensitive elements
- Console warnings for developers

## 🚀 Deployment

### Git Repository Setup
```bash
git init
git remote add origin https://github.com/Charlescifix/boldmunch.git
git add .
git commit -m "Initial commit: Bold Munch bakery website"
git push -u origin main
```

### Railway Deployment
1. **Repository**: https://github.com/Charlescifix/boldmunch.git
2. Connect repository to Railway platform
3. Environment automatically detected
4. Builds and deploys automatically
5. Custom domain available

### Local Development
```bash
python server.py
```
Visit `http://localhost:8000`

## 📁 Project Structure

```
bold_munch/
├── 📄 server.js              # Main Express server
├── 📁 api/                   # API route handlers
│   ├── delivery.js           # Delivery zone validation
│   ├── orders.js            # Order management
│   └── whatsapp.js          # WhatsApp integration
├── 📁 database/             # Database and migrations
│   ├── init.sql             # Database schema
│   └── migrate.js           # Migration runner
├── 📁 styles/               # CSS stylesheets
│   └── main.css             # Main stylesheet (OPTIMIZED)
├── 📁 scripts/              # Client-side JavaScript
│   └── main.js              # Main application logic (OPTIMIZED)
├── 📁 utils/                # Utility modules
│   ├── delivery.js          # Delivery calculations
│   ├── imageOptimizer.js    # Image processing
│   └── whatsapp.js          # WhatsApp utilities
├── 📄 home.html             # Main menu page
├── 📄 order.html            # Order form (OPTIMIZED)
├── 📄 admin.html            # Admin dashboard (OPTIMIZED)
└── 📄 package.json          # Dependencies and scripts
```

## 🎨 Design System

### Colors
- **Cream Background**: #FFF9F3
- **Gold Accent**: #D4A574
- **Bronze Text**: #8B6914
- **Burgundy CTA**: #8B2635
- **Sage Green**: #9CAF88

### Typography
- **Headers**: Poppins (600-700)
- **Body**: Inter (400-600)

## 🔄 Next Steps for Backend

1. Implement FastAPI backend
2. Add PostgreSQL database
3. Create API endpoints for:
   - Product management
   - Order processing
   - Customer management
   - Inventory tracking

## 📞 Contact

Bold Munch Bakery - Fresh Baked Delights
- Delivery: Saturdays
- Order Deadline: Friday 9AM

---

*Powered by Gen3block AI*