// Variety options for mini banana breads (all £3.50 each)
const miniVarieties = [
  "Classic Banana Bread",
  "Double Chocolate Banana Bread",
  "Nutella Banana Bread",
  "Carrot Banana Bread",
  "Coconut Bounty Banana Bread",
  "Nutty Banana Bread",
  "Oats Crumble Banana Bread",
  "Oreo Banana Bread"
];

const MINI_CLASSIC_PRICE = 2;
const MINI_OTHER_PRICE = 2.5;

// State for mini selections
const miniSelections = new Map(); // productId -> array of {variety, size, price}

// --- Data ---
const products = [
  // TOP SECTION - Classics, Chocolate, Nutella
  {
    id:"banana-classic",
    name:"Classic Banana Bread",
    desc:"Traditional banana bread perfection.",
    prices:{medium:11, maxi:17},
    img:"Classic banana bread.jpg",
    type:"bread",
    sizes:["medium","maxi"],
    priority:1
  },
  {
    id:"double-choc",
    name:"Double Chocolate Banana Bread",
    desc:"Ultra-rich chocolate banana bread dream.",
    prices:{medium:14, maxi:21},
    img:"Double Chocolate Bread.jpg",
    type:"bread",
    sizes:["medium","maxi"],
    priority:1
  },
  {
    id:"nutella-classic",
    name:"Nutella Banana Bread",
    desc:"Rich Nutella swirl in every slice.",
    prices:{medium:14, maxi:21},
    img:"Nutella Bread 2.jpg",
    type:"bread",
    sizes:["medium","maxi"],
    priority:1
  },
  {
    id:"carrot-banana",
    name:"Carrot Banana Bread",
    desc:"Packed with Carrot, Raisins and Walnuts.",
    prices:{medium:13, maxi:20},
    img:"carrot banana bread.jpeg",
    type:"bread",
    sizes:["medium","maxi"],
    priority:1
  },
  // MIDDLE SECTION - Other banana bread varieties
  {
    id:"banana-coconut",
    name:"Coconut Bounty Banana Bread",
    desc:"Tropical Coconut and Chocoloate Delight.",
    prices:{medium:14, maxi:21},
    img:"Coconut bounty banana bread.PNG",
    type:"bread",
    sizes:["medium","maxi"],
    priority:2
  },
  {
    id:"banana-nutty",
    name:"Nutty Banana Bread",
    desc:"Loaded with Crunchy Nuts.",
    prices:{medium:15, maxi:22},
    img:"Nutty banana bread.PNG",
    type:"bread",
    sizes:["medium","maxi"],
    priority:2
  },
  {
    id:"banana-oats",
    name:"Oats Crumble Banana Bread",
    desc:"Hearty oats topping with a buttery crunch.",
    prices:{medium:13, maxi:20},
    img:"Oats crumble banana bread.JPG",
    type:"bread",
    sizes:["medium","maxi"],
    priority:2
  },
  {
    id:"banana-oreo",
    name:"Oreo Banana Bread",
    desc:"Chunks of Oreo in every bite.",
    prices:{medium:14, maxi:21},
    img:"Oreos Banana bread.JPG",
    type:"bread",
    sizes:["medium","maxi"],
    priority:2
  },
  {
    id:"choco-nuts",
    name:"Chocolate Nuts Banana Bread",
    desc:"Decadent chocolate with crunchy nuts.",
    prices:{medium:15, maxi:22},
    img:"Choco Nuts.jpg",
    type:"bread",
    sizes:["medium","maxi"],
    priority:2
  },
  // BOTTOM SECTION - Mini, Meat Pie, Puff Puff
  {
    id:"banana-mini",
    name:"Mini Banana Breads",
    desc:"Choose from all our delicious varieties.",
    price:2,
    img:"Banana bread mini 3.jpg",
    type:"minimum",
    minOrder:6,
    priority:4
  },
  {
    id:"meatpie-classic",
    name:"Traditional Meat Pie",
    desc:"Golden pastry with juicy beef filling.",
    price:3.5,
    img:"MEATPIE.PNG",
    type:"minimum",
    minOrder:10,
    priority:3
  },
  {
    id:"puff-puff",
    name:"Nigerian Puff Puff",
    desc:"Donut vibes, upgraded.",
    price:0.8,
    img:"Puff Puff.jpg",
    type:"minimum",
    minOrder:20,
    priority:3
  }
];

// --- State ---
const cart = new Map();
const selectedSizes = new Map();

// Persistent cart in localStorage
function saveCart() {
  const cartData = {
    items: Array.from(cart.values()),
    subtotal: calculateSubtotal()
  };
  localStorage.setItem('boldMunchOrder', JSON.stringify(cartData));
  updateCartDisplay();
}

function loadCart() {
  const saved = localStorage.getItem('boldMunchOrder');
  if (saved) {
    try {
      const cartData = JSON.parse(saved);
      cart.clear();
      cartData.items.forEach((item) => {
        // Create a unique key for the cart item
        let cartKey = item.productId;
        if (item.size) cartKey += `-${item.size}`;
        if (item.type === 'mini') cartKey += `-mini-${Math.random().toString(36).substr(2, 9)}`;
        cart.set(cartKey, item);
      });
      updateCartDisplay();
    } catch (error) {
      console.error('Error loading cart:', error);
      localStorage.removeItem('boldMunchOrder');
    }
  }
}

function calculateSubtotal() {
  let total = 0;
  cart.forEach(item => {
    total += (item.price * item.qty);
  });
  return Math.round(total * 100) / 100;
}

function updateCartDisplay() {
  const cartBar = document.getElementById('cartBar');
  const cartCount = document.getElementById('cartCount');
  const cartTotal = document.getElementById('cartTotal');
  const modalCartTotal = document.getElementById('modalCartTotal');
  
  const itemCount = Array.from(cart.values()).reduce((sum, item) => sum + item.qty, 0);
  const subtotal = calculateSubtotal();
  
  if (itemCount > 0) {
    cartBar.style.display = 'block';
    cartCount.textContent = itemCount;
    cartTotal.textContent = subtotal.toFixed(2);
    if (modalCartTotal) modalCartTotal.textContent = subtotal.toFixed(2);
  } else {
    cartBar.style.display = 'none';
  }
  
  updateCartModal();
}

function removeFromCart(cartKey) {
  cart.delete(cartKey);
  saveCart();
  updateCartDisplay();
}

function showCartModal() {
  const modal = document.getElementById('cartModal');
  modal.classList.remove('hidden');
  updateCartModal();
}

function hideCartModal() {
  const modal = document.getElementById('cartModal');
  modal.classList.add('hidden');
}

function updateCartModal() {
  const cartItems = document.getElementById('cartItems');
  if (!cartItems) return;
  
  if (cart.size === 0) {
    cartItems.innerHTML = '<p style="text-align:center;color:var(--bronze);">Your cart is empty</p>';
    return;
  }
  
  let html = '';
  cart.forEach((item, cartKey) => {
    html += `
      <div class="cart-item">
        <div class="cart-item-details">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-meta">
            Quantity: ${item.qty}${item.size ? ` • Size: ${item.size}` : ''}${item.variety ? ` • ${item.variety}` : ''}
          </div>
        </div>
        <div class="cart-item-price">£${(item.price * item.qty).toFixed(2)}</div>
        <button class="remove-btn" onclick="removeFromCart('${cartKey}')" title="Remove item">×</button>
      </div>
    `;
  });
  
  cartItems.innerHTML = html;
}

// --- Helpers ---
const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => [...el.querySelectorAll(q)];
const money = (n) => n.toLocaleString('en-GB',{style:'currency',currency:'GBP'});

function renderMenu(){
  const grid = $('#menuGrid');
  grid.innerHTML = '';
  // Sort products by priority (1=top, 2=middle, 3=bottom)
  const sortedProducts = [...products].sort((a, b) => a.priority - b.priority);
  sortedProducts.forEach(p=>{
    // Initialize selected size for bread items
    if(p.type === 'bread' && !selectedSizes.has(p.id)){
      selectedSizes.set(p.id, 'medium');
    }
    
    const card = document.createElement('article');
    // Apply special styling for mini banana bread
    if (p.id === 'banana-mini') {
      card.className = 'card mini-card';
    } else {
      card.className = 'card';
    }
    
    // Size selector HTML for bread items
    const sizeSelector = p.type === 'bread' ? `
      <div class="size-selector" data-product="${p.id}">
        ${p.sizes.map(size => `
          <div class="size-btn ${selectedSizes.get(p.id) === size ? 'active' : ''}" data-size="${size}">
            ${size.charAt(0).toUpperCase() + size.slice(1)}
          </div>
        `).join('')}
      </div>
    ` : '';

    // Special handling for mini banana bread
    const miniSelector = (p.id === 'banana-mini') ? `
      <div class="mini-selector-container">
        <select class="variety-dropdown" data-product="${p.id}">
          <option value="">Select a variety...</option>
          ${miniVarieties.map(variety => `
            <option value="${variety}">${variety}</option>
          `).join('')}
        </select>
        <div class="mini-selection-list" data-product="${p.id}"></div>
        <div class="mini-progress">
          <div class="progress-text">0 of 6 minimum selected</div>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
        </div>
        <div class="mini-total">
          <div class="total-row">
            <span class="total-label">Total Items:</span>
            <span class="total-value total-items">0</span>
          </div>
          <div class="total-row">
            <span class="total-label">Total Price:</span>
            <span class="total-value total-price">£0.00</span>
          </div>
        </div>
        <button class="mini-add-btn" data-product="${p.id}" disabled>
          Add to Cart (Minimum 6 Required)
        </button>
      </div>
    ` : '';

    // Get current price based on selected size or fixed price
    const currentPrice = p.type === 'bread' ? 
      p.prices[selectedSizes.get(p.id)] : p.price;
    
    const defaultQty = p.minOrder || 0;
    
    // Calculate total minimum order price for minimum order items
    const priceDisplay = p.type === 'minimum' ? 
      `${money(currentPrice)} each<br><small style="color: var(--bronze); font-weight: 600;">Min order: ${p.minOrder} (${money(currentPrice * p.minOrder)} total)</small>` :
      money(currentPrice);
    
    card.innerHTML = `
      <img class="card-img" src="${p.img}" alt="${p.name}">
      <div class="card-body">
        <div class="title">${p.name}</div>
        <div class="desc">${p.desc}</div>
        ${sizeSelector}
        ${miniSelector}
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px" class="mt-8">
          <div class="price" data-product="${p.id}">${priceDisplay}</div>
          <div class="stepper" data-id="${p.id}">
            <div class="pill minus" aria-label="decrease quantity">–</div>
            <div class="qty" aria-live="polite">${defaultQty}</div>
            <div class="pill plus" aria-label="increase quantity">+</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:center" class="mt-8">
          <button class="btn add" data-id="${p.id}">Add to Cart ➜</button>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  // Hook up size selectors
  $$('.size-selector').forEach(selector => {
    const productId = selector.dataset.product;
    $$('.size-btn', selector).forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.size-btn', selector).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const size = btn.dataset.size;
        selectedSizes.set(productId, size);
        
        // Update price display
        const product = products.find(p => p.id === productId);
        const priceEl = $(`.price[data-product="${productId}"]`);
        priceEl.textContent = money(product.prices[size]);
      });
    });
  });

  // Hook up mini banana bread selectors
  $$('.variety-dropdown').forEach(dropdown => {
    dropdown.addEventListener('change', (e) => {
      const productId = dropdown.dataset.product;
      const varietyName = e.target.value;
      
      if (varietyName && productId === 'banana-mini') {
        const price = varietyName === 'Classic Banana Bread' ? MINI_CLASSIC_PRICE : MINI_OTHER_PRICE;
        addMiniSelection(productId, varietyName, price);
        dropdown.value = ''; // Reset dropdown
      }
    });
  });

  $$('.mini-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = btn.dataset.product;
      addMiniToCart(productId);
    });
  });

  // Hook up steppers & buttons
  $$('.stepper').forEach(step=>{
    const id = step.dataset.id;
    const product = products.find(p => p.id === id);
    const qtyEl = $('.qty', step);
    const minus = $('.minus', step);
    const plus = $('.plus', step);
    let tempQty = product?.minOrder || 0;
    qtyEl.textContent = tempQty;

    minus.addEventListener('click',()=>{
      const minQty = product?.minOrder || 0;
      tempQty = Math.max(minQty, tempQty-1);
      qtyEl.textContent = tempQty;
      updatePriceDisplay(id, tempQty);
    });
    plus.addEventListener('click',()=>{
      tempQty+=1;
      qtyEl.textContent=tempQty;
      updatePriceDisplay(id, tempQty);
    });
    
    // Add button
    const addBtn = step.parentElement.parentElement.querySelector('.add');
    addBtn.addEventListener('click',()=>{
      const qtyToAdd = tempQty > 0 ? tempQty : 1;
      addToCart(id, qtyToAdd);
      tempQty = product?.minOrder || 0; 
      qtyEl.textContent = tempQty;
    });
  });
}

function addMiniSelection(productId, varietyName, price) {
  if (!miniSelections.has(productId)) {
    miniSelections.set(productId, []);
  }
  
  const selections = miniSelections.get(productId);
  selections.push({ variety: varietyName, price });
  
  updateMiniDisplay(productId);
}

function removeMiniSelection(productId, index) {
  const selections = miniSelections.get(productId);
  selections.splice(index, 1);
  updateMiniDisplay(productId);
}

function updateMiniDisplay(productId) {
  const selections = miniSelections.get(productId) || [];
  const listContainer = $(`.mini-selection-list[data-product="${productId}"]`);
  const progressText = listContainer.parentElement.querySelector('.progress-text');
  const progressFill = listContainer.parentElement.querySelector('.progress-fill');
  const totalItems = listContainer.parentElement.querySelector('.total-items');
  const totalPrice = listContainer.parentElement.querySelector('.total-price');
  const addBtn = listContainer.parentElement.querySelector('.mini-add-btn');
  const card = listContainer.closest('.mini-card');
  
  // Update selection list
  listContainer.innerHTML = '';
  let total = 0;
  
  selections.forEach((selection, index) => {
    const item = document.createElement('div');
    item.className = 'selection-item';
    item.innerHTML = `
      <span class="selection-name">${selection.variety}</span>
      <span class="selection-price">£${selection.price.toFixed(2)}</span>
      <button class="remove-selection" onclick="removeMiniSelection('${productId}', ${index})">×</button>
    `;
    listContainer.appendChild(item);
    total += selection.price;
  });
  
  // Show/hide selection list
  if (selections.length > 0) {
    listContainer.classList.add('expanded');
    card.classList.add('expanded');
  } else {
    listContainer.classList.remove('expanded');
    card.classList.remove('expanded');
  }
  
  // Update progress
  const count = selections.length;
  const percentage = Math.min((count / 6) * 100, 100);
  progressText.textContent = `${count} of 6 minimum selected`;
  progressFill.style.width = `${percentage}%`;
  
  // Update totals
  totalItems.textContent = count;
  totalPrice.textContent = `£${total.toFixed(2)}`;
  
  // Update button state
  if (count >= 6) {
    addBtn.disabled = false;
    addBtn.textContent = `Add ${count} Mini Breads to Cart`;
    progressText.style.color = '#4CAF50';
  } else {
    addBtn.disabled = true;
    addBtn.textContent = `Add to Cart (${6 - count} more needed)`;
    progressText.style.color = 'var(--burgundy)';
  }
}

function updatePriceDisplay(productId, qty) {
  const product = products.find(p => p.id === productId);
  const priceEl = $(`.price[data-product="${productId}"]`);
  
  if (!product || !priceEl) return;
  
  if (product.type === 'minimum') {
    const totalPrice = product.price * qty;
    priceEl.innerHTML = `${money(product.price)} each<br><small style="color: var(--bronze); font-weight: 600;">Total: ${money(totalPrice)}</small>`;
  } else if (product.type === 'bread') {
    const selectedSize = selectedSizes.get(productId) || 'medium';
    const unitPrice = product.prices[selectedSize];
    if (qty > 1) {
      const totalPrice = unitPrice * qty;
      priceEl.innerHTML = `${money(unitPrice)} each<br><small style="color: var(--bronze); font-weight: 600;">Total: ${money(totalPrice)}</small>`;
    } else {
      priceEl.textContent = money(unitPrice);
    }
  } else if (product.price) {
    if (qty > 1) {
      const totalPrice = product.price * qty;
      priceEl.innerHTML = `${money(product.price)} each<br><small style="color: var(--bronze); font-weight: 600;">Total: ${money(totalPrice)}</small>`;
    } else {
      priceEl.textContent = money(product.price);
    }
  }
}

function addMiniToCart(productId) {
  const selections = miniSelections.get(productId) || [];
  
  if (selections.length < 6) {
    showNotification(`Please select at least 6 mini breads. You currently have ${selections.length} selected.`, 'error');
    return;
  }
  
  // Add each selection to cart
  selections.forEach((selection, index) => {
    const cartKey = `${productId}-mini-${index}`;
    const cartItem = {
      productId: productId,
      name: `Mini ${selection.variety}`,
      price: selection.price,
      qty: 1,
      variety: selection.variety,
      type: 'mini'
    };
    
    cart.set(cartKey, cartItem);
  });
  
  // Clear selections
  miniSelections.set(productId, []);
  updateMiniDisplay(productId);
  
  showNotification(`Successfully added ${selections.length} mini banana breads to your cart!`, 'success');
  console.log('Mini breads added to cart:', selections);
  saveCart();
}

function addToCart(id, qty){
  // Skip mini banana bread - it has its own handler
  if (id === 'banana-mini') {
    showNotification('Please use the variety selector above to choose your mini breads!', 'error');
    return;
  }
  
  const product = products.find(p=>p.id===id);
  const size = product.type === 'bread' ? selectedSizes.get(id) : null;
  
  // Create unique cart key
  let cartKey = id;
  if(size) cartKey += `-${size}`;
  
  const prev = cart.get(cartKey)?.qty || 0;
  
  // Create cart item with proper price and info
  const price = product.type === 'bread' ? product.prices[size] : product.price;
  
  const cartItem = {
    productId: id,
    name: product.name,
    price: price,
    qty: prev + qty,
    size: size,
    type: product.type
  };
  
  cart.set(cartKey, cartItem);
  console.log('Added to cart:', cartItem);
  saveCart();
}

async function requestSpecialDelivery(){
  const message = `Hello Bold Munch! 🎉

I'm interested in event catering for:
□ Birthday party (kids/adults)
□ Wedding celebration
□ Corporate event/meeting
□ Baby shower
□ Graduation party
□ Anniversary celebration
□ Holiday party (Christmas/Easter)
□ Other special event

Event details:
• Date & time:
• Number of guests:
• Preferred items:
• Special requirements:

Please contact me to discuss!

Thank you! 🍰`;

  try {
    const response = await fetch('/api/whatsapp/generate-enquiry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        enquiryType: 'event_catering',
        message: message 
      })
    });
    
    const data = await response.json();
    
    if (data.success && data.whatsappUrl) {
      window.open(data.whatsappUrl, '_blank');
    } else {
      showNotification('Unable to open WhatsApp. Please try again later.', 'error');
    }
  } catch (error) {
    console.error('WhatsApp error:', error);
    showNotification('Connection error. Please check your internet and try again.', 'error');
  }
}

async function makeEnquiry(){
  const message = `Hello Bold Munch! 👋

I have some questions about:
□ Product availability
□ Pricing and bulk orders
□ Delivery areas & times
□ Custom flavor requests
□ Dietary restrictions/allergies
□ Event catering packages
□ Other enquiry

Please get back to me when convenient.

Thank you!`;

  try {
    const response = await fetch('/api/whatsapp/generate-enquiry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        enquiryType: 'general',
        message: message 
      })
    });
    
    const data = await response.json();
    
    if (data.success && data.whatsappUrl) {
      window.open(data.whatsappUrl, '_blank');
    } else {
      showNotification('Unable to open WhatsApp. Please try again later.', 'error');
    }
  } catch (error) {
    console.error('WhatsApp error:', error);
    showNotification('Connection error. Please check your internet and try again.', 'error');
  }
}

function showIngredients(){
  const ingredientsInfo = `🍞 BOLD MUNCH INGREDIENTS 🍞

🥖 CLASSIC BANANA BREAD:
• Fresh ripe bananas
• Premium flour
• Brown sugar
• Free-range eggs
• Butter
• Vanilla extract
• Baking powder
• Salt

🍫 CHOCOLATE VARIETIES:
• Belgian dark chocolate
• Cocoa powder
• Chocolate chips

🥥 SPECIALTY ADDITIONS:
• Coconut flakes
• Mixed nuts (almonds, walnuts)
• Rolled oats
• Oreo cookies
• Nutella spread

🥧 MEAT PIE:
• Minced beef
• Onions & spices
• Puff pastry
• Carrots & potatoes

🍩 PUFF PUFF:
• Flour
• Sugar
• Yeast
• Nutmeg
• Vegetable oil

⚠️ ALLERGEN INFO:
• Contains: Gluten, Eggs, Dairy, Nuts
• Made in facility that processes nuts

💚 All ingredients are fresh & quality sourced!`;

  showIngredientModal(ingredientsInfo);
}

// --- Notification System ---
function showNotification(message, type = 'info', duration = 5000) {
  const container = document.getElementById('notificationContainer');
  if (!container) return;
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  const messageEl = document.createElement('div');
  messageEl.className = 'notification-message';
  messageEl.textContent = sanitizeInput(message);
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'notification-close';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = () => removeNotification(notification);
  
  notification.appendChild(messageEl);
  notification.appendChild(closeBtn);
  container.appendChild(notification);
  
  // Animate in
  setTimeout(() => notification.classList.add('show'), 100);
  
  // Auto-remove after duration
  setTimeout(() => removeNotification(notification), duration);
}

function removeNotification(notification) {
  if (!notification || !notification.parentNode) return;
  
  notification.classList.remove('show');
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 400);
}

function showIngredientModal(content) {
  // Create modal backdrop
  const modal = document.createElement('div');
  modal.className = 'cart-modal';
  modal.style.display = 'flex';
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.className = 'cart-content';
  modalContent.style.maxWidth = '600px';
  modalContent.style.maxHeight = '80vh';
  
  // Add header and content
  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 style="margin: 0; font-family: Poppins, sans-serif; color: var(--charcoal);">🍞 Ingredients Information</h3>
      <button onclick="this.closest('.cart-modal').remove()" style="background: #e74c3c; color: white; border: none; width: 30px; height: 30px; border-radius: 15px; cursor: pointer; font-size: 16px; font-weight: bold;">×</button>
    </div>
    <div style="white-space: pre-line; font-size: 14px; line-height: 1.6; color: var(--charcoal); max-height: 60vh; overflow-y: auto;">${sanitizeInput(content)}</div>
    <div style="margin-top: 20px; text-align: center;">
      <button onclick="this.closest('.cart-modal').remove()" style="padding: 12px 24px; background: linear-gradient(145deg, var(--burgundy), #D35400); color: white; border: none; border-radius: 12px; font-weight: 800; cursor: pointer;">Close</button>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Close on backdrop click
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
  
  // Prevent content clicks from closing modal
  modalContent.onclick = (e) => e.stopPropagation();
}

// Input Sanitization
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Validate and sanitize form inputs
function validateInput(input, type = 'text') {
  if (!input || typeof input !== 'string') return '';
  
  // Remove potentially dangerous characters
  input = input.trim();
  
  switch (type) {
    case 'email':
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return emailRegex.test(input) ? sanitizeInput(input) : '';
    case 'phone':
      const phoneRegex = /^[\d\s\+\-\(\)]{7,20}$/;
      return phoneRegex.test(input) ? sanitizeInput(input) : '';
    case 'postcode':
      const postcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
      return postcodeRegex.test(input) ? sanitizeInput(input.toUpperCase()) : '';
    default:
      return sanitizeInput(input).substring(0, 500); // Limit length
  }
}

// CSP and XSS Protection
function preventXSS() {
  // Remove any inline event handlers that might be injected
  const elements = document.querySelectorAll('*');
  elements.forEach(el => {
    for (let attr of el.attributes) {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    }
  });
}

// --- Security & Protection ---
// Disable right-click context menu
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  return false;
});

// Disable common developer shortcuts
document.addEventListener('keydown', (e) => {
  // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
  if (e.key === 'F12' || 
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
      (e.ctrlKey && e.key === 'U')) {
    e.preventDefault();
    return false;
  }
});

// Disable text selection on sensitive elements
document.addEventListener('selectstart', (e) => {
  if (e.target.classList.contains('no-select')) {
    e.preventDefault();
    return false;
  }
});

// Basic obfuscation warning
console.clear();
console.log('%cSTOP!', 'color: red; font-size: 50px; font-weight: bold;');
console.log('%cThis is a browser feature intended for developers. Bold Munch content is protected.', 'color: red; font-size: 16px;');

// --- Events ---
document.addEventListener('DOMContentLoaded',()=>{
  preventXSS(); // Run XSS protection on load
  renderMenu();
  loadCart();
});