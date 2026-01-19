// POS System Application for Naseeb Biryani and Pakwan Center
class POSSystem {
    constructor() {
        this.data = {
            store: {},
            categories: [],
            products: [],
            orders: [],
            paymentMethods: [],
            orderTypes: [],
            settings: {}
        };
        
        this.cart = [];
        this.selectedOrderType = 'dinein';
        this.selectedPaymentMethod = 'cash';
        this.editingProduct = null;
        this.tempOrder = null;
        
        this.init();
    }
    
    async init() {
        await this.loadData();
        this.initializeUI();
        this.bindEvents();
        this.updatePrintStyles();
        this.renderPOS();
        this.updateSalesSummary();
        this.filterSales();
        this.updateAnalytics();
        this.showToast('POS System Loaded Successfully', 'success');
    }
    
    async loadData() {
        try {
            // Try to load from Firebase REST API first
            try {
                const response = await fetch('https://poss-2b64e-default-rtdb.asia-southeast1.firebasedatabase.app/posData.json');
                if (response.ok) {
                    this.data = await response.json();
                    console.log('✓ Data loaded from Firebase');
                    return;
                }
            } catch (error) {
                console.warn('Could not load from Firebase, trying localStorage...', error);
            }
            
            // Try to load from localStorage
            const savedData = localStorage.getItem('posData');
            if (savedData) {
                this.data = JSON.parse(savedData);
                console.log('✓ Data loaded from localStorage');
            } else {
                // Load initial data from data.json directly
                const response = await fetch('data.json');
                if (response.ok) {
                    this.data = await response.json();
                    console.log('✓ Data loaded from data.json');
                } else {
                    // Fallback to default data
                    this.data = this.getDefaultData();
                    console.log('✓ Using default data');
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.data = this.getDefaultData();
        }
        this.saveData();
    }

    async refreshStoreSettingsFromFirebase() {
        try {
            const response = await fetch('https://poss-2b64e-default-rtdb.asia-southeast1.firebasedatabase.app/posData.json');
            if (!response.ok) {
                return;
            }
            const firebaseData = await response.json();
            if (firebaseData && firebaseData.store) {
                this.data.store = { ...this.data.store, ...firebaseData.store };
            }
            if (firebaseData && firebaseData.settings) {
                this.data.settings = { ...this.data.settings, ...firebaseData.settings };
            }
            localStorage.setItem('posData', JSON.stringify(this.data));
        } catch (error) {
            console.warn('Could not refresh settings from Firebase:', error);
        }
    }
    
    getDefaultData() {
        return {
            store: {
                name: "Naseeb Biryani and Pakwan Center",
                address: "Main Street, Karachi, Pakistan",
                phone: "+92 300 1234567",
                email: "info@naseebbiryani.com",
                taxRate: 0,
                logo: "resources/LOGO.jpg",
                receiptHeader: "Thank you for dining with us!",
                receiptFooter: "Follow us @naseebbiryani"
            },
            categories: [
                { id: "biryanis", name: "Biryanis", color: "#DC2626", emoji: "🍛" },
                { id: "karahi", name: "Karahi & Handi", color: "#EA580C", emoji: "🍲" },
                { id: "bbq", name: "BBQ & Grilled", color: "#D97706", emoji: "🍖" },
                { id: "breads", name: "Breads & Naan", color: "#92400E", emoji: "🍞" },
                { id: "rice", name: "Rice & Pulao", color: "#059669", emoji: "🍚" },
                { id: "drinks", name: "Beverages", color: "#2563EB", emoji: "🥤" }
            ],
            products: [
                { id: "chicken_biryani", name: "Chicken Biryani", price: 320, category: "biryanis", emoji: "", description: "Aromatic basmati rice with tender chicken and traditional spices" },
                { id: "beef_biryani", name: "Beef Biryani", price: 380, category: "biryanis", emoji: "", description: "Rich beef biryani with slow-cooked meat and fragrant rice" },
                { id: "mutton_biryani", name: "Mutton Biryani", price: 420, category: "biryanis", emoji: "", description: "Traditional mutton biryani with tender goat meat" },
                { id: "chicken_karahi", name: "Chicken Karahi", price: 450, category: "karahi", emoji: "", description: "Spicy chicken karahi cooked in traditional wok with tomatoes" },
                { id: "mutton_karahi", name: "Mutton Karahi", price: 550, category: "karahi", emoji: "", description: "Tender mutton pieces in rich tomato-based curry" },
                { id: "chicken_handi", name: "Chicken Handi", price: 480, category: "karahi", emoji: "", description: "Creamy chicken curry cooked in clay pot" }
            ],
            paymentMethods: [
                { id: "cash", name: "Cash", emoji: "💵" },
                { id: "card", name: "Card", emoji: "💳" },
                { id: "easypaisa", name: "EasyPaisa", emoji: "📱" },
                { id: "jazzcash", name: "JazzCash", emoji: "📱" }
            ],
            orderTypes: [
                { id: "dinein", name: "Dine-in", emoji: "🍽️" },
                { id: "takeaway", name: "Takeaway", emoji: "🥡" },
                { id: "delivery", name: "Delivery", emoji: "🚚" }
            ],
            orders: [],
            settings: { 
                currency: "PKR", 
                receiptWidth: 80, 
                autoPrint: false, 
                showTax: false, 
                nextOrderNumber: 1,
                thermalWidth: 80,
                printOrientation: 'portrait',
                printMargin: 0,
                printCopies: 1
            }
        };
    }
    
    saveData() {
        // Save to localStorage for quick access
        localStorage.setItem('posData', JSON.stringify(this.data));
        
        // Save to Firebase (cloud database)
        this.saveToFirebase();
    }
    
    async saveToFirebase() {
        try {
            const response = await fetch('https://poss-2b64e-default-rtdb.asia-southeast1.firebasedatabase.app/posData.json', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.data)
            });
            if (response.ok) {
                console.log('✓ Data saved to Firebase successfully');
            } else {
                console.warn('Firebase save returned status:', response.status);
            }
        } catch (error) {
            console.warn('Could not save to Firebase (continuing with localStorage):', error);
        }
    }
    
    initializeUI() {
        // Initialize category filter
        const categoryFilter = document.getElementById('categoryFilter');
        categoryFilter.innerHTML = '<option value="">All Categories</option>';
        this.data.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categoryFilter.appendChild(option);
        });
        
        // Initialize product category select
        const productCategory = document.getElementById('productCategory');
        productCategory.innerHTML = '<option value="">Select Category</option>';
        this.data.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            productCategory.appendChild(option);
        });
        
        // Initialize settings
        this.loadSettings();
    }
    
    loadSettings() {
        document.getElementById('storeName').value = this.data.store.name || '';
        document.getElementById('storeAddress').value = this.data.store.address || '';
        document.getElementById('storePhone').value = this.data.store.phone || '';
        document.getElementById('storeEmail').value = this.data.store.email || '';
        document.getElementById('receiptHeader').value = this.data.store.receiptHeader || '';
        document.getElementById('receiptFooter').value = this.data.store.receiptFooter || '';
        
        // Load printer settings
        document.getElementById('printCopies').value = this.data.settings.printCopies || 1;
        
        // Render categories list
        this.renderCategoriesList();
        
        // Initialize color display
        document.getElementById('colorDisplay').style.backgroundColor = document.getElementById('categoryColor').value;
    }
    
    bindEvents() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // Cart sidebar close button
        const closeBtn = document.getElementById('closeSidebarBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeCartSidebar());
        }
        
        // Close sidebar on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCartSidebar();
            }
        });
        
        // Product search and filter
        document.getElementById('productSearch').addEventListener('input', () => this.filterProducts());
        document.getElementById('categoryFilter').addEventListener('change', () => this.filterProducts());
        
        // Cart actions
        document.getElementById('clearCartBtn').addEventListener('click', () => this.clearCart());
        document.getElementById('checkoutBtn').addEventListener('click', () => this.checkout());
        
        // Menu management
        document.getElementById('addProductBtn').addEventListener('click', () => this.openProductModal());
        document.getElementById('closeProductModal').addEventListener('click', () => this.closeProductModal());
        document.getElementById('cancelProduct').addEventListener('click', () => this.closeProductModal());
        document.getElementById('productForm').addEventListener('submit', (e) => this.saveProduct(e));
        
        // Sales actions
        document.getElementById('exportSalesBtn').addEventListener('click', () => this.exportSalesCSV());
        document.getElementById('salesPeriodFilter').addEventListener('change', () => this.filterSales());
        
        // Analytics
        document.getElementById('analyticsPeriodFilter').addEventListener('change', () => this.updateAnalytics());
        
        // Settings
        document.getElementById('saveStoreInfo').addEventListener('click', () => this.saveStoreInfo());
        document.getElementById('saveReceiptSettings').addEventListener('click', () => this.saveReceiptSettings());
        document.getElementById('savePrinterSettings').addEventListener('click', () => this.savePrinterSettings());
        document.getElementById('testPrint').addEventListener('click', () => this.testPrint());
        
        // Category management
        document.getElementById('addCategoryBtn').addEventListener('click', () => this.addCategory());
        document.getElementById('categoryColor').addEventListener('input', (e) => this.updateColorDisplay(e.target.value));
        
        // Data management
        document.getElementById('exportAllData').addEventListener('click', () => this.exportAllData());
        document.getElementById('importAllData').addEventListener('click', () => this.openImportModal());
        document.getElementById('clearAllData').addEventListener('click', () => this.clearAllData());
        
        // Import modal
        document.getElementById('closeImportModal').addEventListener('click', () => this.closeImportModal());
        document.getElementById('cancelImport').addEventListener('click', () => this.closeImportModal());
        document.getElementById('confirmImport').addEventListener('click', () => this.importData());
        
        // Receipt modal
        document.getElementById('closeReceiptModal').addEventListener('click', () => this.closeReceiptModal());
        document.getElementById('closeReceipt').addEventListener('click', () => this.closeReceiptModal());
        document.getElementById('printReceipt').addEventListener('click', () => this.printReceipt());
    }
    
    updateColorDisplay(color) {
        document.getElementById('colorDisplay').style.backgroundColor = color;
    }
    
    addCategory() {
        const name = document.getElementById('categoryName').value.trim();
        const color = document.getElementById('categoryColor').value;
        const emoji = document.getElementById('categoryEmoji').value.trim();
        
        if (!name) {
            this.showToast('Please enter a category name', 'error');
            return;
        }
        
        // Check if category already exists
        if (this.data.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
            this.showToast('Category already exists', 'error');
            return;
        }
        
        const newCategory = {
            id: name.toLowerCase().replace(/\s+/g, '_'),
            name: name,
            color: color,
            emoji: emoji || '📦'
        };
        
        this.data.categories.push(newCategory);
        this.saveData();
        this.showToast('Category added successfully', 'success');
        
        // Clear inputs
        document.getElementById('categoryName').value = '';
        document.getElementById('categoryEmoji').value = '';
        document.getElementById('categoryColor').value = '#EF4444';
        
        this.renderCategoriesList();
        this.renderProducts();
    }
    
    editCategory(categoryId) {
        const category = this.data.categories.find(c => c.id === categoryId);
        if (!category) return;
        
        const newName = prompt('Enter new category name:', category.name);
        if (!newName || newName.trim() === '') return;
        
        const newColor = prompt('Enter new color (hex):', category.color);
        if (!newColor) return;
        
        const newEmoji = prompt('Enter new emoji:', category.emoji);
        if (newEmoji === null) return;
        
        category.name = newName;
        category.color = newColor;
        category.emoji = newEmoji || '📦';
        
        this.saveData();
        this.showToast('Category updated successfully', 'success');
        this.renderCategoriesList();
        this.renderProducts();
    }
    
    deleteCategory(categoryId) {
        const category = this.data.categories.find(c => c.id === categoryId);
        if (!category) return;
        
        // Check if category is in use
        const productsInCategory = this.data.products.filter(p => p.category === categoryId);
        if (productsInCategory.length > 0) {
            this.showToast(`Cannot delete category with ${productsInCategory.length} product(s)`, 'error');
            return;
        }
        
        if (confirm(`Delete category "${category.name}"?`)) {
            this.data.categories = this.data.categories.filter(c => c.id !== categoryId);
            this.saveData();
            this.showToast('Category deleted successfully', 'success');
            this.renderCategoriesList();
        }
    }
    
    renderCategoriesList() {
        const categoriesList = document.getElementById('categoriesList');
        if (!categoriesList) return;
        
        if (this.data.categories.length === 0) {
            categoriesList.innerHTML = '<p style="color: #9CA3AF; text-align: center;">No categories yet</p>';
            return;
        }
        
        categoriesList.innerHTML = this.data.categories.map(category => `
            <div class="category-item">
                <div class="category-info">
                    <div class="category-color-box" style="background-color: ${category.color}"></div>
                    <div class="category-details">
                        <div class="category-name">${category.emoji} ${category.name}</div>
                        <small style="color: #9CA3AF;">${category.id}</small>
                    </div>
                </div>
                <div class="category-actions">
                    <button class="btn-sm btn-edit" onclick="posSystem.editCategory('${category.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-sm btn-delete" onclick="posSystem.deleteCategory('${category.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Render tab-specific content
        switch (tabName) {
            case 'pos':
                this.renderPOS();
                break;
            case 'sales':
                this.renderSales();
                break;
            case 'menu':
                this.renderMenu();
                break;
            case 'analytics':
                this.renderAnalytics();
                break;
            case 'settings':
                this.refreshStoreSettingsFromFirebase()
                    .then(() => this.loadSettings())
                    .catch(() => this.loadSettings());
                break;
        }
    }
    
    renderPOS() {
        this.renderProducts();
        this.renderCart();
        this.updateCartSummary();
    }
    
    renderProducts() {
        const productsGrid = document.getElementById('productsGrid');
        productsGrid.innerHTML = '';
        
        // Group products by category
        const groupedProducts = {};
        this.data.categories.forEach(category => {
            groupedProducts[category.id] = {
                name: category.name,
                color: category.color,
                products: this.data.products.filter(p => p.category === category.id)
            };
        });
        
        // Render each category section with products
        Object.entries(groupedProducts).forEach(([categoryId, categoryData]) => {
            if (categoryData.products.length === 0) return; // Skip empty categories
            
            // Create category section
            const categorySection = document.createElement('div');
            categorySection.className = 'pos-category-section';
            categorySection.setAttribute('data-category', categoryId);
            
            // Category header - REMOVED
            // const categoryHeader = document.createElement('div');
            // categoryHeader.className = 'pos-category-header';
            // categoryHeader.style.backgroundColor = categoryData.color + '20';
            // categoryHeader.style.borderLeftColor = categoryData.color;
            // categoryHeader.innerHTML = `
            //     <h3 style="color: ${categoryData.color}; margin: 0;">
            //         ${categoryData.name}
            //     </h3>
            // `;
            // categorySection.appendChild(categoryHeader);
            
            // Category items container
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'pos-category-items';
            
            // Add products to category
            categoryData.products.forEach(product => {
                const productCard = document.createElement('div');
                productCard.className = 'product-card';
                productCard.setAttribute('data-category', product.category);
                productCard.innerHTML = `
                    <h4 class="product-card-name">${product.name}</h4>
                    <div class="product-card-price">Rs. ${product.price}</div>
                    <div class="product-card-description">${product.description}</div>
                `;
                
                productCard.addEventListener('click', () => this.addToCart(product));
                itemsContainer.appendChild(productCard);
            });
            
            categorySection.appendChild(itemsContainer);
            productsGrid.appendChild(categorySection);
        });
    }
    
    filterProducts() {
        const searchTerm = document.getElementById('productSearch').value.toLowerCase();
        const categoryFilter = document.getElementById('categoryFilter').value;
        const productCards = document.querySelectorAll('.product-card');
        
        productCards.forEach((card, index) => {
            const product = this.data.products[index];
            const matchesSearch = product.name.toLowerCase().includes(searchTerm) || 
                                product.description.toLowerCase().includes(searchTerm);
            const matchesCategory = !categoryFilter || product.category === categoryFilter;
            
            if (matchesSearch && matchesCategory) {
                card.style.display = 'block';
                card.style.animation = `cardPopIn 0.3s var(--transition-timing) ${index * 0.05}s both`;
            } else {
                card.style.display = 'none';
            }
        });
    }
    
    addToCart(product) {
        const existingItem = this.cart.find(item => item.productId === product.id);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                category: product.category
            });
        }
        
        // Open the sidebar when adding item
        this.openCartSidebar();
        this.renderCart();
        this.updateCartSummary();
        this.showToast(`Added ${product.name} to cart`, 'success');
    }
    
    openCartSidebar() {
        const sidebar = document.getElementById('cartSidebar');
        const posLayout = document.querySelector('.pos-layout');
        if (sidebar) {
            sidebar.classList.add('active');
        }
        if (posLayout) {
            posLayout.classList.add('sidebar-open');
        }
    }
    
    closeCartSidebar() {
        const sidebar = document.getElementById('cartSidebar');
        const posLayout = document.querySelector('.pos-layout');
        if (sidebar) {
            sidebar.classList.remove('active');
        }
        if (posLayout) {
            posLayout.classList.remove('sidebar-open');
        }
    }
    
    renderCart() {
        const cartItems = document.getElementById('cartItems');
        
        if (this.cart.length === 0) {
            cartItems.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart empty-icon"></i>
                    <p>Your cart is empty</p>
                    <p class="empty-subtitle">Add items to get started</p>
                </div>
            `;
            return;
        }
        
        cartItems.innerHTML = '';
        this.cart.forEach((item, index) => {
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.setAttribute('data-category', item.category);
            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">Rs. ${item.price} each</div>
                </div>
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="posSystem.updateQuantity(${index}, -1)">−</button>
                    <span class="quantity-display">${item.quantity}</span>
                    <button class="quantity-btn" onclick="posSystem.updateQuantity(${index}, 1)">+</button>
                </div>
                <button class="remove-item" onclick="posSystem.removeFromCart(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            cartItems.appendChild(cartItem);
        });
    }
    
    updateQuantity(index, change) {
        this.cart[index].quantity += change;
        if (this.cart[index].quantity <= 0) {
            this.cart.splice(index, 1);
        }
        this.renderCart();
        this.updateCartSummary();
    }
    
    removeFromCart(index) {
        this.cart.splice(index, 1);
        this.renderCart();
        this.updateCartSummary();
    }
    
    clearCart() {
        this.cart = [];
        this.renderCart();
        this.updateCartSummary();
        this.showToast('Cart cleared', 'info');
    }
    
    updateCartSummary() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal; // No tax for PKR
        
        document.getElementById('checkoutAmount').textContent = `Rs. ${total}`;
        
        // Enable/disable checkout button
        const checkoutBtn = document.getElementById('checkoutBtn');
        if (this.cart.length === 0) {
            checkoutBtn.disabled = true;
            checkoutBtn.style.opacity = '0.5';
        } else {
            checkoutBtn.disabled = false;
            checkoutBtn.style.opacity = '1';
        }
    }
    

    
    checkout() {
        if (this.cart.length === 0) return;
        
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal; // No tax for PKR
        
        const order = {
            id: `ORD-${String(this.data.settings.nextOrderNumber).padStart(3, '0')}`,
            timestamp: new Date().toISOString(),
            items: this.cart.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price
            })),
            subtotal: subtotal,
            tax: 0,
            total: total,
            paymentMethod: this.selectedPaymentMethod,
            orderType: this.selectedOrderType,
            status: 'completed'
        };
        
        // Store temporary order for display purposes
        this.tempOrder = order;
        this.showReceipt(order);
    }
    
    showReceipt(order) {
        const modal = document.getElementById('receiptModal');
        const receiptContent = document.getElementById('receiptContent');
        
        const paymentMethod = this.data.paymentMethods.find(pm => pm.id === order.paymentMethod);
        
        // Get the base URL for loading images in the print window
        const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
        
        let receiptHTML = `
            <div class="receipt-header">
                <img src="${baseUrl}resources/R-LOGO.png" alt="${this.data.store.name}" class="receipt-logo">
                <div class="receipt-store-name">${this.data.store.name}</div>
                <div class="receipt-store-info">${this.data.store.address}</div>
                <div class="receipt-store-info">Mobile: ${this.data.store.phone}</div>
                <div class="receipt-title">Sale Invoice</div>
            </div>
            
            <div class="receipt-meta">
                <div class="receipt-meta-row">
                    <span>Invoice No.</span>
                    <span>${order.id}</span>
                </div>
                <div class="receipt-meta-row">
                    <span>Date</span>
                    <span>${new Date(order.timestamp).toLocaleString()}</span>
                </div>
            </div>
            
            <div class="receipt-items">
                <div class="receipt-items-header">
                    <span class="col-product">Product</span>
                    <span class="col-qty">Qty</span>
                    <span class="col-price">Unit Price</span>
                </div>
        `;
        
        order.items.forEach(item => {
            const product = this.data.products.find(p => p.id === item.productId);
            receiptHTML += `
                <div class="receipt-item">
                    <span class="col-product">${product?.name || 'Unknown'}</span>
                    <span class="col-qty">${item.quantity}</span>
                    <span class="col-price">${item.price}</span>
                </div>
            `;
        });
        
        receiptHTML += `
            </div>
            
            <div class="receipt-totals">
                <div class="receipt-total-line">
                    <span>Subtotal:</span>
                    <span>Rs ${order.subtotal}</span>
                </div>
        `;
        
        receiptHTML += `
                <div class="receipt-total-line final">
                    <span>Total:</span>
                    <span>Rs ${order.total}</span>
                </div>
                <div class="receipt-total-line">
                    <span>${paymentMethod?.name} (${new Date(order.timestamp).toLocaleDateString()})</span>
                    <span>Rs ${order.total}</span>
                </div>
            </div>
            
            <div class="receipt-footer">
                <div>${this.data.store.receiptHeader}</div>
                <div>${this.data.store.receiptFooter}</div>
            </div>
        `;
        
        receiptContent.innerHTML = receiptHTML;
        modal.classList.add('active');
    }
    
    closeReceiptModal() {
        // If user cancels without printing, don't save the order
        this.tempOrder = null;
        document.getElementById('receiptModal').classList.remove('active');
    }
    
    printReceipt() {
        // Validate receipt is ready
        if (!this.tempOrder) {
            this.showToast('No order to print. Please create an order first.', 'error');
            return;
        }
        
        // Save the order to database when print is confirmed
        try {
            this.data.orders.push(this.tempOrder);
            this.data.settings.nextOrderNumber += 1;
            this.saveData();
            
            this.cart = [];
            this.renderCart();
            this.updateCartSummary();
            
            this.showToast(`Order ${this.tempOrder.id} being sent to printer...`, 'info');
            
            // Use the thermal printer settings
            this.performPrint();
            
            // Close modal after printing
            setTimeout(() => {
                this.closeReceiptModal();
                this.filterSales();
                this.updateAnalytics();
                this.showToast(`Order ${this.tempOrder.id} completed successfully!`, 'success');
            }, 500);
            
            this.tempOrder = null;
        } catch (error) {
            console.error('Error in printReceipt:', error);
            this.showToast('Error processing print. Please check console for details.', 'error');
        }
    }
    
    renderSales() {
        this.filterSales();
        this.updateSalesSummary();
    }
    
    filterSales() {
        const period = document.getElementById('salesPeriodFilter').value;
        const now = new Date();
        let filteredOrders = this.data.orders;
        
        switch (period) {
            case 'today':
                filteredOrders = this.data.orders.filter(order => 
                    new Date(order.timestamp).toDateString() === now.toDateString()
                );
                break;
            case 'week':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                filteredOrders = this.data.orders.filter(order => 
                    new Date(order.timestamp) >= weekAgo
                );
                break;
            case 'month':
                const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                filteredOrders = this.data.orders.filter(order => 
                    new Date(order.timestamp) >= monthAgo
                );
                break;
            case 'year':
                const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                filteredOrders = this.data.orders.filter(order => 
                    new Date(order.timestamp) >= yearAgo
                );
                break;
        }
        
        this.renderSalesTable(filteredOrders);
        this.updateSalesSummary();
    }
    
    renderSalesTable(orders) {
        const tbody = document.getElementById('salesTableBody');
        tbody.innerHTML = '';
        
        orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        orders.forEach(order => {
            const paymentMethod = this.data.paymentMethods.find(pm => pm.id === order.paymentMethod);
            const status = order.status || 'completed';
            const statusColor = status === 'returned' ? '#EF4444' : status === 'deleted' ? '#9CA3AF' : '#10B981';
            const statusText = status === 'returned' ? 'Returned' : status === 'deleted' ? 'Deleted' : 'Completed';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${order.id}</td>
                <td>${new Date(order.timestamp).toLocaleString()}</td>
                <td>${order.items.length} items</td>
                <td>Rs. ${order.total}</td>
                <td>${paymentMethod?.name}</td>
                <td><span style="color: ${statusColor}; font-weight: 600;">${statusText}</span></td>
                <td>
                    <button class="btn-text btn-danger" onclick="posSystem.viewOrder('${order.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-text btn-danger" onclick="posSystem.reprintReceipt('${order.id}')">
                        <i class="fas fa-print"></i> Print
                    </button>
                    ${status === 'completed' ? `
                    <button class="btn-text btn-danger" onclick="posSystem.returnOrder('${order.id}')">
                        <i class="fas fa-undo"></i> Return
                    </button>
                    <button class="btn-text btn-danger" onclick="posSystem.deleteOrder('${order.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                    ` : ''}
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    updateSalesSummary() {
        const period = document.getElementById('salesPeriodFilter').value;
        const orders = this.getFilteredOrders(period);
        
        // Only count completed orders for revenue
        const completedOrders = orders.filter(o => (o.status || 'completed') === 'completed');
        const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0);
        const totalOrders = completedOrders.length;
        const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
        
        const summaryContainer = document.getElementById('salesSummary');
        summaryContainer.innerHTML = `
            <div class="summary-card">
                <h3>Total Revenue</h3>
                <div class="value">Rs. ${totalRevenue}</div>
                <div class="change">${period === 'today' ? 'Today' : 'This ' + period.charAt(0).toUpperCase() + period.slice(1)}</div>
            </div>
            <div class="summary-card">
                <h3>Total Orders</h3>
                <div class="value">${totalOrders}</div>
                <div class="change">${period === 'today' ? 'Today' : 'This ' + period.charAt(0).toUpperCase() + period.slice(1)}</div>
            </div>
            <div class="summary-card">
                <h3>Average Order</h3>
                <div class="value">Rs. ${avgOrder}</div>
                <div class="change">Per transaction</div>
            </div>
        `;
    }
    
    viewOrder(orderId) {
        const order = this.data.orders.find(o => o.id === orderId);
        if (order) {
            this.showReceipt(order);
        }
    }
    
    reprintReceipt(orderId) {
        const order = this.data.orders.find(o => o.id === orderId);
        if (order) {
            this.showReceipt(order);
            // Open modal to allow user to print
            const modal = document.getElementById('receiptModal');
            if (modal) {
                modal.classList.add('active');
            }
        } else {
            this.showToast('Order not found', 'error');
        }
    }
    
    returnOrder(orderId) {
        const order = this.data.orders.find(o => o.id === orderId);
        if (order && confirm(`Are you sure you want to return order ${orderId}? This cannot be undone.`)) {
            order.status = 'returned';
            order.returnedAt = new Date().toISOString();
            this.saveData();
            this.filterSales();
            this.updateAnalytics();
            this.showToast(`Order ${orderId} marked as returned`, 'success');
        }
    }
    
    deleteOrder(orderId) {
        const order = this.data.orders.find(o => o.id === orderId);
        if (order && confirm(`Are you sure you want to delete order ${orderId}? This cannot be undone.`)) {
            order.status = 'deleted';
            order.deletedAt = new Date().toISOString();
            this.saveData();
            this.filterSales();
            this.updateAnalytics();
            this.showToast(`Order ${orderId} marked as deleted`, 'success');
        }
    }
    
    exportSalesCSV() {
        const period = document.getElementById('salesPeriodFilter').value;
        const orders = this.getFilteredOrders(period);
        
        let csv = 'Order ID,Date,Items,Subtotal,Total,Payment Method,Order Type\n';
        
        orders.forEach(order => {
            const orderType = this.data.orderTypes.find(ot => ot.id === order.orderType);
            const paymentMethod = this.data.paymentMethods.find(pm => pm.id === order.paymentMethod);
            const items = order.items.map(item => {
                const product = this.data.products.find(p => p.id === item.productId);
                return `${product?.name || 'Unknown'} x${item.quantity}`;
            }).join('; ');
            
            csv += `"${order.id}","${new Date(order.timestamp).toLocaleString()}","${items}",${order.subtotal},${order.total},"${paymentMethod?.name || ''}","${orderType?.name || ''}"\n`;
        });
        
        this.downloadCSV(csv, `sales-${period}-${new Date().toISOString().split('T')[0]}.csv`);
        this.showToast('Sales data exported successfully', 'success');
    }
    
    getFilteredOrders(period) {
        const now = new Date();
        let filteredOrders = this.data.orders;
        
        switch (period) {
            case 'today':
                return this.data.orders.filter(order => 
                    new Date(order.timestamp).toDateString() === now.toDateString()
                );
            case 'week':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return this.data.orders.filter(order => 
                    new Date(order.timestamp) >= weekAgo
                );
            case 'month':
                const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                return this.data.orders.filter(order => 
                    new Date(order.timestamp) >= monthAgo
                );
            case 'year':
                const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                return this.data.orders.filter(order => 
                    new Date(order.timestamp) >= yearAgo
                );
            default:
                return this.data.orders;
        }
    }
    
    renderMenu() {
        const menuGrid = document.getElementById('menuGrid');
        menuGrid.innerHTML = '';
        
        // Group products by category
        const groupedProducts = {};
        this.data.categories.forEach(category => {
            groupedProducts[category.id] = {
                name: category.name,
                color: category.color,
                products: this.data.products.filter(p => p.category === category.id)
            };
        });
        
        // Render each category section
        Object.entries(groupedProducts).forEach(([categoryId, categoryData]) => {
            if (categoryData.products.length === 0) return; // Skip empty categories
            
            // Create category section
            const categorySection = document.createElement('div');
            categorySection.className = 'menu-category-section';
            
            // Category header
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'menu-category-header';
            categoryHeader.style.backgroundColor = categoryData.color + '20';
            categoryHeader.style.borderLeftColor = categoryData.color;
            categoryHeader.innerHTML = `
                <h3 style="color: ${categoryData.color}; margin: 0;">
                    <i class="fas fa-tag"></i> ${categoryData.name}
                </h3>
            `;
            categorySection.appendChild(categoryHeader);
            
            // Category items container
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'menu-category-items';
            
            // Add products to category
            categoryData.products.forEach(product => {
                const menuItem = document.createElement('div');
                menuItem.className = 'menu-item-card';
                menuItem.setAttribute('data-category', product.category);
                menuItem.innerHTML = `
                    <div class="menu-item-header">
                        <div class="menu-item-info">
                            <h4>${product.name}</h4>
                            <div class="menu-item-description">${product.description}</div>
                        </div>
                        <div class="menu-item-price">Rs. ${product.price}</div>
                    </div>
                    <div class="menu-item-footer">
                        <div class="menu-item-actions">
                            <button class="btn-secondary btn-small" onclick="posSystem.editProduct('${product.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn-danger btn-small" onclick="posSystem.deleteProduct('${product.id}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
                itemsContainer.appendChild(menuItem);
            });
            
            categorySection.appendChild(itemsContainer);
            menuGrid.appendChild(categorySection);
        });
    }
    
    openProductModal(productId = null) {
        this.editingProduct = productId ? this.data.products.find(p => p.id === productId) : null;
        const modal = document.getElementById('productModal');
        const title = document.getElementById('productModalTitle');
        
        title.textContent = this.editingProduct ? 'Edit Product' : 'Add Product';
        
        if (this.editingProduct) {
            document.getElementById('productName').value = this.editingProduct.name;
            document.getElementById('productPrice').value = this.editingProduct.price;
            document.getElementById('productCategory').value = this.editingProduct.category;
            document.getElementById('productDescription').value = this.editingProduct.description;
        } else {
            document.getElementById('productForm').reset();
        }
        
        modal.classList.add('active');
    }
    
    closeProductModal() {
        document.getElementById('productModal').classList.remove('active');
        this.editingProduct = null;
    }
    
    editProduct(productId) {
        this.openProductModal(productId);
    }
    
    deleteProduct(productId) {
        if (confirm('Are you sure you want to delete this product?')) {
            this.data.products = this.data.products.filter(p => p.id !== productId);
            this.saveData();
            this.renderMenu();
            this.renderProducts();
            this.showToast('Product deleted successfully', 'success');
        }
    }
    
    saveProduct(e) {
        e.preventDefault();
        
        const productData = {
            name: document.getElementById('productName').value,
            price: parseInt(document.getElementById('productPrice').value) || 0,
            category: document.getElementById('productCategory').value,
            description: document.getElementById('productDescription').value,
            emoji: '' // No emoji icons in cards
        };
        
        if (this.editingProduct) {
            // Update existing product
            const index = this.data.products.findIndex(p => p.id === this.editingProduct.id);
            this.data.products[index] = { ...this.data.products[index], ...productData };
            this.showToast('Product updated successfully', 'success');
        } else {
            // Add new product
            const newProduct = {
                id: this.generateProductId(productData.name),
                ...productData
            };
            this.data.products.push(newProduct);
            this.showToast('Product added successfully', 'success');
        }
        
        this.saveData();
        this.closeProductModal();
        this.renderMenu();
        this.renderProducts();
    }
    
    generateProductId(name) {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    }
    
    renderAnalytics() {
        this.updateAnalytics();
    }
    
    updateAnalytics() {
        const period = document.getElementById('analyticsPeriodFilter').value;
        const orders = this.getFilteredOrders(period);
        
        // Calculate only completed orders for revenue
        const completedOrders = orders.filter(o => (o.status || 'completed') === 'completed');
        const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0);
        const totalOrders = completedOrders.length;
        const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
        
        // Calculate returned orders stats
        const returnedOrders = orders.filter(o => o.status === 'returned');
        const totalReturned = returnedOrders.length;
        const totalReturnedAmount = returnedOrders.reduce((sum, order) => sum + order.total, 0);
        
        // Update summary cards
        document.getElementById('revenueValue').textContent = `Rs. ${totalRevenue}`;
        document.getElementById('ordersValue').textContent = totalOrders;
        document.getElementById('avgOrderValue').textContent = `Rs. ${avgOrder}`;
        document.getElementById('returnedOrdersValue').textContent = totalReturned;
        document.getElementById('returnedAmountValue').textContent = `Rs. ${totalReturnedAmount} returned`;
        
        // Update top products
        this.renderTopProducts(completedOrders);
        this.renderRevenueByItems(completedOrders);
        this.renderRevenueByCategories(completedOrders);
    }
    
    renderTopProducts(orders) {
        const productCounts = {};
        
        orders.forEach(order => {
            order.items.forEach(item => {
                productCounts[item.productId] = (productCounts[item.productId] || 0) + item.quantity;
            });
        });
        
        const sortedProducts = Object.entries(productCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
        
        const container = document.getElementById('topProducts');
        container.innerHTML = '';
        
        sortedProducts.forEach(([productId, count]) => {
            const product = this.data.products.find(p => p.id === productId);
            if (product) {
                const item = document.createElement('div');
                item.className = 'top-product-item';
                item.innerHTML = `
                    <span class="top-product-name">${product.name}</span>
                    <span class="top-product-count">${count}</span>
                `;
                container.appendChild(item);
            }
        });
    }
    
    renderRevenueByItems(orders) {
        const itemRevenue = {};
        
        orders.forEach(order => {
            order.items.forEach(item => {
                const product = this.data.products.find(p => p.id === item.productId);
                if (product) {
                    const revenue = item.quantity * item.price;
                    itemRevenue[item.productId] = {
                        name: product.name,
                        revenue: (itemRevenue[item.productId]?.revenue || 0) + revenue
                    };
                }
            });
        });
        
        const sortedItems = Object.entries(itemRevenue)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
        
        const container = document.getElementById('revenueByItems');
        container.innerHTML = '';
        
        if (sortedItems.length === 0) {
            container.innerHTML = '<p style="color: #9CA3AF; text-align: center;">No sales data</p>';
            return;
        }
        
        sortedItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'revenue-item';
            div.innerHTML = `
                <span class="revenue-item-name">${item.name}</span>
                <span class="revenue-item-amount">Rs. ${item.revenue}</span>
            `;
            container.appendChild(div);
        });
    }
    
    renderRevenueByCategories(orders) {
        const categoryRevenue = {};
        
        orders.forEach(order => {
            order.items.forEach(item => {
                const product = this.data.products.find(p => p.id === item.productId);
                if (product) {
                    const category = this.data.categories.find(c => c.id === product.category);
                    const categoryName = category?.name || 'Unknown';
                    const revenue = item.quantity * item.price;
                    categoryRevenue[product.category] = {
                        name: categoryName,
                        revenue: (categoryRevenue[product.category]?.revenue || 0) + revenue
                    };
                }
            });
        });
        
        const sortedCategories = Object.entries(categoryRevenue)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 6);
        
        const container = document.getElementById('revenueByCategories');
        container.innerHTML = '';
        
        if (sortedCategories.length === 0) {
            container.innerHTML = '<p style="color: #9CA3AF; text-align: center;">No sales data</p>';
            return;
        }
        
        sortedCategories.forEach(category => {
            const div = document.createElement('div');
            div.className = 'revenue-category';
            div.innerHTML = `
                <span class="revenue-category-name">${category.name}</span>
                <span class="revenue-category-amount">Rs. ${category.revenue}</span>
            `;
            container.appendChild(div);
        });
    }
    
    saveStoreInfo() {
        this.data.store.name = document.getElementById('storeName').value;
        this.data.store.address = document.getElementById('storeAddress').value;
        this.data.store.phone = document.getElementById('storePhone').value;
        this.data.store.email = document.getElementById('storeEmail').value;
        
        this.saveData();
        this.showToast('Store information saved successfully', 'success');
    }
    
    saveReceiptSettings() {
        this.data.store.receiptHeader = document.getElementById('receiptHeader').value;
        this.data.store.receiptFooter = document.getElementById('receiptFooter').value;
        
        this.saveData();
        this.showToast('Receipt settings saved successfully', 'success');
    }
    
    savePrinterSettings() {
        this.data.settings.autoPrint = document.getElementById('autoPrintEnabled').checked;
        this.data.settings.thermalWidth = parseInt(document.getElementById('thermalWidth').value);
        this.data.settings.printOrientation = document.getElementById('printOrientation').value;
        this.data.settings.printMargin = parseFloat(document.getElementById('printMargin').value);
        this.data.settings.printCopies = parseInt(document.getElementById('printCopies').value);
        
        this.saveData();
        this.updatePrintStyles();
        this.showToast('Printer settings saved successfully', 'success');
    }
    
    testPrint() {
        this.showToast('Opening print dialog for test page...', 'info');
        console.log('Test Print initiated');
        console.log('Printer Settings:', this.data.settings);
        
        // Create a simple test receipt
        const testContent = `
            <div class="receipt-header" style="text-align: center; margin-bottom: 10px;">
                <div style="font-size: 14px; font-weight: bold;">TEST PRINT PAGE</div>
                <div style="font-size: 11px;">${this.data.store.name}</div>
                <div style="font-size: 10px;">${this.data.store.address}</div>
                <div style="font-size: 10px;">${this.data.store.phone}</div>
            </div>
            <div style="font-size: 11px; border-bottom: 1px dashed #999; padding-bottom: 8px; margin-bottom: 8px;">
                <div>Test Order: ORD-TEST-001</div>
                <div>Date: ${new Date().toLocaleString()}</div>
                <div>Paper Width: 80mm (Thermal Printer)</div>
            </div>
            <div style="font-size: 11px; border-bottom: 1px dashed #999; padding-bottom: 8px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Chicken Biryani x1</span>
                    <span>Rs. 320</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Mutton Karahi x1</span>
                    <span>Rs. 550</span>
                </div>
                <div style="border-top: 1px dashed #999; padding-top: 5px; margin-top: 5px; display: flex; justify-content: space-between; font-weight: bold;">
                    <span>Total:</span>
                    <span>Rs. 870</span>
                </div>
            </div>
            <div style="text-align: center; font-size: 10px; margin-top: 10px;">
                <div>${this.data.store.receiptHeader}</div>
                <div>${this.data.store.receiptFooter}</div>
                <div style="margin-top: 5px; font-size: 9px;">✓ Test print successful</div>
            </div>
        `;
        
        const receiptContent = document.getElementById('receiptContent');
        if (!receiptContent) {
            this.showToast('Receipt content element not found', 'error');
            return;
        }
        
        const originalContent = receiptContent.innerHTML;
        receiptContent.innerHTML = testContent;
        
        // Wait a moment then print
        setTimeout(() => {
            try {
                this.performPrint();
                // Restore original content
                setTimeout(() => {
                    receiptContent.innerHTML = originalContent;
                }, 500);
            } catch (error) {
                console.error('Error in testPrint:', error);
                receiptContent.innerHTML = originalContent;
                this.showToast('Error: ' + error.message, 'error');
            }
        }, 100);
    }
    
    updatePrintStyles() {
        // Remove old styles if they exist
        const existingStyle = document.getElementById('thermalPrintStyles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        // Create new print styles based on settings
        const width = this.data.settings.thermalWidth;
        const margin = this.data.settings.printMargin;
        const styles = `
            @page {
                size: ${width}mm auto;
                margin: ${margin}mm ${margin * 0.75}mm;
            }
        `;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'thermalPrintStyles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }
    
    performPrint() {
        const copies = this.data.settings.printCopies || 1;
        
        // Get receipt content
        const receiptContent = document.getElementById('receiptContent');
        if (!receiptContent) {
            this.showToast('Receipt content not found', 'error');
            return;
        }
        
        const receiptHTML = receiptContent.innerHTML;
        
        const printDocument = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Receipt</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    html, body {
                        width: 80mm;
                        margin: 0;
                        padding: 0;
                    }
                    
                    @page {
                        size: 80mm auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    @media print {
                        html, body {
                            width: 80mm !important;
                            height: auto !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                        body {
                            width: 80mm !important;
                            padding: 2mm 3mm !important;
                        }
                    }
                    
                    body {
                        font-family: 'Roboto', Arial, sans-serif;
                        font-size: 11pt;
                        line-height: 1.35;
                        font-weight: 500;
                        width: 80mm;
                        margin: 0;
                        padding: 2mm 3mm;
                        background: white;
                        color: #000;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    
                    .receipt-header {
                        text-align: center;
                        margin-bottom: 1.5mm;
                        padding-bottom: 1.5mm;
                        border-bottom: 1px dashed #000;
                    }
                    
                    .receipt-logo {
                        width: 100px;
                        height: 100px;
                        margin: 0 auto 1mm;
                        display: block;
                    }
                    
                    .receipt-store-name {
                        font-size: 12pt;
                        font-weight: bold;
                        margin-bottom: 1mm;
                    }
                    
                    .receipt-store-info {
                        font-size: 10pt;
                        margin-bottom: 0.3mm;
                    }

                    .receipt-title {
                        font-size: 11pt;
                        font-weight: bold;
                        margin-top: 0.8mm;
                    }
                    
                    .receipt-meta {
                        border-bottom: 1px dashed #000;
                        padding-bottom: 1mm;
                        margin-bottom: 1mm;
                        font-size: 10pt;
                    }
                    
                    .receipt-meta-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 0.4mm;
                    }
                    
                    .receipt-order-info {
                        margin-bottom: 1mm;
                        padding-bottom: 1mm;
                        border-bottom: 1px dashed #000;
                        font-size: 10pt;
                    }
                    
                    .receipt-items {
                        margin-bottom: 1mm;
                        padding-bottom: 1mm;
                        border-bottom: 1px dashed #000;
                    }
                    
                    .receipt-items-header {
                        display: flex;
                        justify-content: space-between;
                        font-weight: bold;
                        border-bottom: 1px dashed #000;
                        padding-bottom: 0.6mm;
                        margin-bottom: 0.6mm;
                        font-size: 10pt;
                    }
                    
                    .receipt-item {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 0.8mm;
                        font-size: 10pt;
                    }
                    
                    .col-product {
                        flex: 1;
                        text-align: left;
                        padding-right: 2mm;
                    }
                    
                    .col-qty {
                        width: 9mm;
                        text-align: center;
                        flex-shrink: 0;
                    }
                    
                    .col-price {
                        width: 16mm;
                        text-align: right;
                        flex-shrink: 0;
                    }
                    
                    .receipt-totals {
                        margin-bottom: 0.8mm;
                        padding-bottom: 0.8mm;
                        border-bottom: 1px dashed #000;
                    }
                    
                    .receipt-total-line {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 0.3mm;
                        font-size: 10pt;
                    }
                    
                    .receipt-total-line.final {
                        font-weight: bold;
                        font-size: 12pt;
                        margin-top: 0.8mm;
                        padding-top: 0.8mm;
                        border-top: 1px dashed #000;
                    }
                    
                    .receipt-footer {
                        text-align: center;
                        font-size: 8pt;
                        margin-top: 1mm;
                    }
                </style>
            </head>
            <body>
                ${receiptHTML}
            </body>
            </html>
        `;
        
        try {
            const existingFrame = document.getElementById('printFrame');
            if (existingFrame && existingFrame.parentNode) {
                existingFrame.parentNode.removeChild(existingFrame);
            }
            
            const printFrame = document.createElement('iframe');
            printFrame.id = 'printFrame';
            printFrame.style.position = 'fixed';
            printFrame.style.right = '0';
            printFrame.style.bottom = '0';
            printFrame.style.width = '0';
            printFrame.style.height = '0';
            printFrame.style.border = '0';
            printFrame.style.visibility = 'hidden';
            document.body.appendChild(printFrame);
            
            const frameWindow = printFrame.contentWindow;
            const frameDocument = frameWindow?.document;
            if (!frameWindow || !frameDocument) {
                this.showToast('Error preparing print frame.', 'error');
                return;
            }
            
            frameDocument.open();
            frameDocument.write(printDocument);
            frameDocument.close();
            
            const triggerPrint = () => {
                try {
                    frameWindow.focus();
                    frameWindow.print();
                    this.showToast('Receipt ready for printing (Thermal Printer - 80mm)...', 'info');
                } catch (err) {
                    console.error('Print error:', err);
                    this.showToast('Error printing receipt.', 'error');
                } finally {
                    setTimeout(() => {
                        if (printFrame && printFrame.parentNode) {
                            printFrame.parentNode.removeChild(printFrame);
                        }
                    }, 500);
                }
            };
            
            if (frameDocument.readyState === 'complete') {
                setTimeout(triggerPrint, 100);
            } else {
                printFrame.onload = () => setTimeout(triggerPrint, 100);
            }
        } catch (error) {
            console.error('Error in performPrint:', error);
            this.showToast('Error preparing receipt for print.', 'error');
        }
    }
    
    exportAllData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `pos-data-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        this.showToast('Data exported successfully', 'success');
    }
    
    openImportModal() {
        document.getElementById('importModal').classList.add('active');
    }
    
    closeImportModal() {
        document.getElementById('importModal').classList.remove('active');
        document.getElementById('importFile').value = '';
    }
    
    importData() {
        const fileInput = document.getElementById('importFile');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showToast('Please select a file to import', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Validate data structure
                if (this.validateDataStructure(importedData)) {
                    this.data = importedData;
                    this.saveData();
                    this.closeImportModal();
                    this.showToast('Data imported successfully', 'success');
                    
                    // Refresh current view
                    const activeTab = document.querySelector('.nav-tab.active').dataset.tab;
                    this.switchTab(activeTab);
                } else {
                    this.showToast('Invalid data format', 'error');
                }
            } catch (error) {
                this.showToast('Error reading file', 'error');
            }
        };
        reader.readAsText(file);
    }
    
    validateDataStructure(data) {
        return data && 
               typeof data === 'object' && 
               Array.isArray(data.products) && 
               Array.isArray(data.orders) && 
               data.store && 
               typeof data.store === 'object';
    }
    
    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            if (confirm('This will delete all products, orders, and settings. Are you absolutely sure?')) {
                localStorage.removeItem('posData');
                location.reload();
            }
        }
    }
    
    downloadCSV(csv, filename) {
        const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(csvBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        
        URL.revokeObjectURL(url);
    }
    
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastIcon = document.getElementById('toastIcon');
        const toastMessage = document.getElementById('toastMessage');
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        toastIcon.className = icons[type] || icons.info;
        toastMessage.textContent = message;
        
        toast.classList.add('active');
        
        setTimeout(() => {
            toast.classList.remove('active');
        }, 3000);
    }
}

// Initialize POS System when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.posSystem = new POSSystem();
});

// Handle page visibility changes for data sync
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.posSystem) {
        window.posSystem.saveData();
    }
});
