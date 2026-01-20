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
        
        // Month-based system
        this.activeMonth = this.getCurrentMonth(); // Format: YYYY-MM
        this.selectedDateWithinMonth = null; // For filtering within active month
        
        this.init();
    }
    
    getCurrentMonth() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }
    
    formatMonthDisplay(monthStr) {
        const [year, month] = monthStr.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    
    async init() {
        await this.loadData();
        
        // Check and warn about duplicates on startup
        const orderIds = this.data.orders.map(o => o.id);
        const duplicates = orderIds.filter((id, index) => orderIds.indexOf(id) !== index);
        if (duplicates.length > 0) {
            const uniqueDups = [...new Set(duplicates)];
            console.warn(`⚠️⚠️⚠️ WARNING: Found ${uniqueDups.length} duplicate order ID(s) on startup:`, uniqueDups);
            console.warn(`Total duplicate instances: ${orderIds.length - new Set(orderIds).size}`);
            console.warn('Run posSystem.cleanupDuplicateOrders() in console to clean up');
        }
        
        this.initializeUI();
        this.bindEvents();
        this.updatePrintStyles();
        // Wait longer for DOM to be fully ready - styles loaded, layout calculated
        await new Promise(resolve => setTimeout(resolve, 300));
        this.renderPOS();
        this.updateSalesSummary();
        this.filterSales();
        this.updateAnalytics();
        this.showToast('POS System Loaded Successfully', 'success');
    }
    
    async loadData() {
        try {
            // Try to load from Firebase REST API first with timeout
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout (increased from 3)
                
                const response = await fetch('https://poss-2b64e-default-rtdb.asia-southeast1.firebasedatabase.app/posData.json', {
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const firebaseData = await response.json();
                    if (firebaseData && firebaseData.orders) {
                        this.data = firebaseData;
                        console.log('✓ Data loaded from Firebase (fresh)');
                        // Validate that we have categories
                        if (!this.data.categories || this.data.categories.length === 0) {
                            console.warn('Firebase data missing categories, using defaults');
                            this.data.categories = this.getDefaultData().categories;
                        }
                        if (!this.data.products || this.data.products.length === 0) {
                            console.warn('Firebase data missing products, using defaults');
                            this.data.products = this.getDefaultData().products;
                        }
                        // Ensure all orders have a status field
                        if (this.data.orders && Array.isArray(this.data.orders)) {
                            this.data.orders.forEach(order => {
                                if (!order.status) {
                                    order.status = 'completed';
                                }
                            });
                            const missingStatus = this.data.orders.filter(o => !o.status);
                            if (missingStatus.length > 0) {
                                console.log('⚠️ Fixed missing status for orders:', missingStatus.map(o => o.id));
                            }
                        }
                        // Save to localStorage to update cache
                        localStorage.setItem('posData', JSON.stringify(this.data));
                        return;
                    }
                }
            } catch (error) {
                console.warn('Could not load from Firebase, trying localStorage...', error.message);
            }
            
            // Try to load from localStorage as fallback
            const savedData = localStorage.getItem('posData');
            if (savedData) {
                this.data = JSON.parse(savedData);
                console.log('✓ Data loaded from localStorage (fallback)');
                // Validate that we have categories and products
                if (!this.data.categories || this.data.categories.length === 0) {
                    console.warn('localStorage data missing categories, using defaults');
                    this.data.categories = this.getDefaultData().categories;
                }
                if (!this.data.products || this.data.products.length === 0) {
                    console.warn('localStorage data missing products, using defaults');
                    this.data.products = this.getDefaultData().products;
                }
                // Ensure all orders have a status field
                if (this.data.orders && Array.isArray(this.data.orders)) {
                    this.data.orders.forEach(order => {
                        if (!order.status) {
                            order.status = 'completed';
                        }
                    });
                }
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
                // Ensure all orders have a status field
                if (this.data.orders && Array.isArray(this.data.orders)) {
                    this.data.orders.forEach(order => {
                        if (!order.status) {
                            order.status = 'completed';
                        }
                    });
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
        const dataStr = JSON.stringify(this.data);
        localStorage.setItem('posData', dataStr);
        console.log('✓ Data saved to localStorage');
        console.log('Total orders in storage:', this.data.orders.length);
        console.log('Deleted orders:', this.data.orders.filter(o => o.status === 'deleted').length);
        
        // Save to Firebase (cloud database)
        this.saveToFirebase();
    }
    
    async saveToFirebase() {
        try {
            // Save main data (categories, products, settings, etc)
            const mainDataResponse = await fetch('https://poss-2b64e-default-rtdb.asia-southeast1.firebasedatabase.app/posData.json', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    store: this.data.store,
                    categories: this.data.categories,
                    products: this.data.products,
                    paymentMethods: this.data.paymentMethods,
                    orderTypes: this.data.orderTypes,
                    settings: this.data.settings
                })
            });
            
            if (!mainDataResponse.ok) {
                console.warn('Firebase main data save returned status:', mainDataResponse.status);
            }
            
            // Save orders organized by month
            const ordersGroupedByMonth = {};
            this.data.orders.forEach(order => {
                const orderDate = new Date(order.timestamp);
                const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
                if (!ordersGroupedByMonth[monthKey]) {
                    ordersGroupedByMonth[monthKey] = [];
                }
                ordersGroupedByMonth[monthKey].push(order);
            });
            
            // Save each month's orders separately
            for (const [month, orders] of Object.entries(ordersGroupedByMonth)) {
                const monthOrderResponse = await fetch(`https://poss-2b64e-default-rtdb.asia-southeast1.firebasedatabase.app/salesByMonth/${month}/orders.json`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(orders)
                });
                
                if (monthOrderResponse.ok) {
                    console.log(`✓ Saved ${orders.length} orders for ${month}`);
                } else {
                    console.warn(`Firebase save for month ${month} returned status:`, monthOrderResponse.status);
                }
            }
            
            console.log('✓ All data saved to Firebase successfully (organized by month)');
        } catch (error) {
            console.warn('Could not save to Firebase (continuing with localStorage):', error);
        }
    }
    
    initializeUI() {
        // Category filter removed from POS tab
        
        // Initialize product category select
        const productCategory = document.getElementById('productCategory');
        productCategory.innerHTML = '<option value="">Select Category</option>';
        this.data.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            productCategory.appendChild(option);
        });
        
        // Initialize manual kg category dropdown for custom items
        const manualKgCategory = document.getElementById('manualKgCategory');
        if (manualKgCategory) {
            manualKgCategory.innerHTML = '<option value="">Select Category</option>';
            this.data.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                manualKgCategory.appendChild(option);
            });
        }
        
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
        
        // Initialize month-based sales view
        this.initializeMonthView();
    }
    
    initializeMonthView() {
        // Set the active month input to current month
        const activeMonthInput = document.getElementById('activeMonthFilter');
        if (activeMonthInput) {
            activeMonthInput.value = this.activeMonth;
            activeMonthInput.title = this.formatMonthDisplay(this.activeMonth);
        }
        
        // Set min and max for date filter within month
        const dateFilter = document.getElementById('dateWithinMonthFilter');
        if (dateFilter) {
            const [year, month] = this.activeMonth.split('-');
            const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
            dateFilter.min = `${year}-${month}-01`;
            dateFilter.max = `${year}-${month}-${String(daysInMonth).padStart(2, '0')}`;
        }
    }
    
    changeToPreviousMonth() {
        const [year, month] = this.activeMonth.split('-');
        let prevMonth = parseInt(month) - 1;
        let prevYear = parseInt(year);
        
        if (prevMonth < 1) {
            prevMonth = 12;
            prevYear--;
        }
        
        this.activeMonth = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
        this.selectedDateWithinMonth = null;
        this.updateMonthView();
    }
    
    changeToNextMonth() {
        const [year, month] = this.activeMonth.split('-');
        let nextMonth = parseInt(month) + 1;
        let nextYear = parseInt(year);
        
        if (nextMonth > 12) {
            nextMonth = 1;
            nextYear++;
        }
        
        this.activeMonth = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
        this.selectedDateWithinMonth = null;
        this.updateMonthView();
    }
    
    changeToMonth(monthStr) {
        this.activeMonth = monthStr;
        this.selectedDateWithinMonth = null;
        this.updateMonthView();
    }
    
    updateMonthView() {
        // Update month display
        const activeMonthInput = document.getElementById('activeMonthFilter');
        if (activeMonthInput) {
            activeMonthInput.value = this.activeMonth;
            activeMonthInput.title = this.formatMonthDisplay(this.activeMonth);
        }
        
        // Clear date filter
        const dateFilter = document.getElementById('dateWithinMonthFilter');
        if (dateFilter) {
            dateFilter.value = '';
            const [year, month] = this.activeMonth.split('-');
            const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
            dateFilter.min = `${year}-${month}-01`;
            dateFilter.max = `${year}-${month}-${String(daysInMonth).padStart(2, '0')}`;
        }
        
        // Load data for this month and refresh sales
        this.loadSalesForMonth();
    }
    
    async loadSalesForMonth() {
        console.log(`📅 Loading sales for month: ${this.formatMonthDisplay(this.activeMonth)}`);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            // Try to load from Firebase first
            const response = await fetch(`https://poss-2b64e-default-rtdb.asia-southeast1.firebasedatabase.app/salesByMonth/${this.activeMonth}/orders.json`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const monthOrders = await response.json();
                if (monthOrders) {
                    this.data.orders = Array.isArray(monthOrders) ? monthOrders : Object.values(monthOrders);
                    console.log(`✓ Loaded ${this.data.orders.length} orders for ${this.formatMonthDisplay(this.activeMonth)}`);
                } else {
                    this.data.orders = [];
                    console.log(`No sales history for ${this.formatMonthDisplay(this.activeMonth)}`);
                }
            } else {
                this.data.orders = [];
            }
        } catch (error) {
            console.warn(`Could not load sales for month ${this.activeMonth}:`, error.message);
            this.data.orders = [];
        }
        
        // Refresh sales display
        this.filterSalesWithinMonth();
        this.updateSalesSummary();
    }
    
    filterSalesWithinMonth() {
        const dateFilter = document.getElementById('dateWithinMonthFilter');
        this.selectedDateWithinMonth = dateFilter ? dateFilter.value : null;
        
        let filteredOrders = this.data.orders;
        
        if (this.selectedDateWithinMonth) {
            const filterDate = new Date(this.selectedDateWithinMonth);
            filteredOrders = this.data.orders.filter(order => {
                const orderDate = new Date(order.timestamp);
                return orderDate.toDateString() === filterDate.toDateString();
            });
            console.log(`📊 Filtered to ${filteredOrders.length} orders for ${this.selectedDateWithinMonth}`);
        } else {
            console.log(`📊 Showing all ${filteredOrders.length} orders for ${this.formatMonthDisplay(this.activeMonth)}`);
        }
        
        this.renderSalesTable(filteredOrders);
    }
    
    clearDateFilter() {
        this.selectedDateWithinMonth = null;
        const dateFilter = document.getElementById('dateWithinMonthFilter');
        if (dateFilter) {
            dateFilter.value = '';
        }
        this.filterSalesWithinMonth();
    }
    
    bindEvents() {
        try {
            console.log('bindEvents() starting');
            // Tab navigation
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    const tabName = e.currentTarget.dataset.tab;
                    this.switchTab(tabName);
                });
            });
            console.log('Tab navigation bound');
            
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
            
            // Cart actions
            document.getElementById('clearCartBtn').addEventListener('click', () => this.clearCart());
            document.getElementById('checkoutBtn').addEventListener('click', () => this.checkout());
            
            // Menu management
            document.getElementById('addProductBtn').addEventListener('click', () => this.openProductModal());
            document.getElementById('closeProductModal').addEventListener('click', () => this.closeProductModal());
            document.getElementById('cancelProduct').addEventListener('click', () => this.closeProductModal());
            document.getElementById('productForm').addEventListener('submit', (e) => this.saveProduct(e));
            document.getElementById('productCategory').addEventListener('change', () => this.updateCategoryRateDisplay());
            document.getElementById('productQuantity').addEventListener('change', () => this.updatePriceDisplay());
            
            // Sales actions - NEW MONTH-BASED SYSTEM
            document.getElementById('exportSalesBtn').addEventListener('click', () => this.exportSalesCSV());
            
            // Month navigation
            document.getElementById('prevMonthBtn').addEventListener('click', () => this.changeToPreviousMonth());
            document.getElementById('nextMonthBtn').addEventListener('click', () => this.changeToNextMonth());
            document.getElementById('activeMonthFilter').addEventListener('change', (e) => this.changeToMonth(e.target.value));
            
            // Date filter within month
            document.getElementById('dateWithinMonthFilter').addEventListener('change', () => this.filterSalesWithinMonth());
            document.getElementById('clearDateFilter').addEventListener('click', () => this.clearDateFilter());
            
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
            
            // Category modal
            document.getElementById('closeCategoryModal').addEventListener('click', () => this.closeCategoryModal());
            document.getElementById('cancelCategory').addEventListener('click', () => this.closeCategoryModal());
            document.getElementById('categoryForm').addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveCategoryChanges();
            });
            document.getElementById('editCategoryColor').addEventListener('input', (e) => {
                document.getElementById('editColorDisplay').style.backgroundColor = e.target.value;
            });
            document.getElementById('editCategoryUnit').addEventListener('change', (e) => {
                const unitLabel = {
                    'pcs': 'Rs/pcs',
                    'kg': 'Rs/kg',
                    'gram': 'Rs/g',
                    'ml': 'Rs/ml',
                    'liter': 'Rs/L'
                };
                document.getElementById('categoryUnitDisplay2').textContent = unitLabel[e.target.value] || 'Rs/unit';
            });
            
            // Data management
            document.getElementById('exportAllData').addEventListener('click', () => this.exportAllData());
            document.getElementById('importAllData').addEventListener('click', () => this.openImportModal());
            document.getElementById('clearAllData').addEventListener('click', () => this.clearAllData());
            
            // Import modal
            document.getElementById('closeImportModal').addEventListener('click', () => this.closeImportModal());
            document.getElementById('cancelImport').addEventListener('click', () => this.closeImportModal());
            document.getElementById('confirmImport').addEventListener('click', () => this.importData());
            
            console.log('bindEvents() completed successfully');
        } catch (error) {
            console.error('Error in bindEvents():', error, error.stack);
        }
    }
    
    updateColorDisplay(color) {
        document.getElementById('colorDisplay').style.backgroundColor = color;
    }

    hexToRgba(hex, alpha) {
        if (!hex) {
            return `rgba(0, 0, 0, ${alpha})`;
        }
        let value = hex.replace('#', '').trim();
        if (value.length === 3) {
            value = value.split('').map(ch => ch + ch).join('');
        }
        if (value.length !== 6 || /[^0-9a-f]/i.test(value)) {
            return `rgba(0, 0, 0, ${alpha})`;
        }
        const intValue = parseInt(value, 16);
        const r = (intValue >> 16) & 255;
        const g = (intValue >> 8) & 255;
        const b = intValue & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
        this.openCategoryModal(categoryId);
    }
    
    openCategoryModal(categoryId) {
        const category = this.data.categories.find(c => c.id === categoryId);
        if (!category) return;
        
        // Populate modal with category data
        document.getElementById('editCategoryName').value = category.name;
        document.getElementById('editCategoryColor').value = category.color;
        document.getElementById('editCategoryEmoji').value = category.emoji;
        document.getElementById('editCategoryUnit').value = category.unit || 'pcs';
        document.getElementById('editCategoryBasePrice').value = category.basePrice || 0;
        document.getElementById('editColorDisplay').style.backgroundColor = category.color;
        
        // Update unit display
        const unitSelect = document.getElementById('editCategoryUnit');
        const unitLabel = {
            'pcs': 'Rs/pcs',
            'kg': 'Rs/kg',
            'gram': 'Rs/g',
            'ml': 'Rs/ml',
            'liter': 'Rs/L'
        };
        document.getElementById('categoryUnitDisplay2').textContent = unitLabel[category.unit] || 'Rs/unit';
        
        // Store the category ID for saving
        const modal = document.getElementById('categoryModal');
        modal.setAttribute('data-category-id', categoryId);
        
        // Show modal
        modal.classList.add('active');
    }
    
    closeCategoryModal() {
        const modal = document.getElementById('categoryModal');
        modal.classList.remove('active');
        modal.removeAttribute('data-category-id');
    }
    
    saveCategoryChanges() {
        const modal = document.getElementById('categoryModal');
        const categoryId = modal.getAttribute('data-category-id');
        const category = this.data.categories.find(c => c.id === categoryId);
        
        if (!category) {
            this.showToast('Category not found', 'error');
            return;
        }
        
        const newName = document.getElementById('editCategoryName').value.trim();
        const newColor = document.getElementById('editCategoryColor').value;
        const newEmoji = document.getElementById('editCategoryEmoji').value.trim();
        const newUnit = document.getElementById('editCategoryUnit').value;
        const newBasePrice = parseInt(document.getElementById('editCategoryBasePrice').value) || 0;
        
        if (!newName) {
            this.showToast('Category name cannot be empty', 'error');
            return;
        }
        
        category.name = newName;
        category.color = newColor;
        category.emoji = newEmoji || '📦';
        category.unit = newUnit;
        category.basePrice = newBasePrice;
        
        this.saveData();
        this.closeCategoryModal();
        this.renderCategoriesList();
        this.initializeUI();
        this.renderProducts();
        this.showToast('Category updated successfully', 'success');
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
                    <button class="btn-sm btn-edit" onclick="if(window.posSystem) posSystem.openCategoryModal('${category.id}')">
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
        if (!productsGrid) return;
        
        productsGrid.innerHTML = '';
        
        // Guard against missing data
        if (!this.data.categories || !this.data.products) {
            console.warn('Missing categories or products data');
            return;
        }
        
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
            
            // Category items container
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'pos-category-items';
            
            // Add products to category
            categoryData.products.forEach(product => {
                const productCard = document.createElement('div');
                productCard.className = 'product-card';
                productCard.setAttribute('data-category', product.category);
                const quantity = product.quantity || 1;
                
                // Get price from category basePrice or product price override
                const category = this.data.categories.find(c => c.id === product.category);
                const price = product.price || category?.basePrice || 0;
                const unit = category?.unit || 'pcs';
                const categoryColor = category?.color || '#D1D5DB';

                productCard.style.borderColor = categoryColor;
                productCard.style.background = `linear-gradient(135deg, ${this.hexToRgba(categoryColor, 0.2)} 0%, ${this.hexToRgba(categoryColor, 0.05)} 100%)`;
                
                // Use user-friendly display for kg quantities
                let qtyDisplay = quantity;
                if (unit === 'kg') {
                    qtyDisplay = this.formatQuantityDisplay(quantity);
                } else {
                    const unitLabel = {
                        'gram': 'g',
                        'ml': 'ml',
                        'liter': 'L',
                        'pcs': 'pcs'
                    }[unit] || unit;
                    qtyDisplay = `${quantity} ${unitLabel}`;
                }
                
                productCard.innerHTML = `
                    <h4 class="product-card-name">${product.name}</h4>
                    <div class="product-card-quantity">${qtyDisplay}</div>
                    <div class="product-card-price">Rs. ${price}</div>
                `;
                
                // Ensure product has price for cart operations
                if (!product.price) {
                    product.price = price;
                }
                
                productCard.addEventListener('click', () => this.addToCart(product));
                itemsContainer.appendChild(productCard);
            });
            
            categorySection.appendChild(itemsContainer);
            productsGrid.appendChild(categorySection);
        });
    }
    
    addToCart(product) {
        // Get category color for styling cart items
        const category = this.data.categories.find(c => c.id === product.category);
        const categoryColor = category?.color || '#D1D5DB';
        
        const existingItem = this.cart.find(item => item.productId === product.id);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                category: product.category,
                categoryColor: categoryColor
            });
        }
        
        // Open the sidebar when adding item
        this.openCartSidebar();
        this.renderCart();
        this.updateCartSummary();
        this.showToast(`Added ${product.name} to cart`, 'success');
    }
    
    addCustomKgItem() {
        const categorySelect = document.getElementById('manualKgCategory');
        const priceInput = document.getElementById('manualKgPrice');
        
        if (!categorySelect.value) {
            this.showToast('Please select a category', 'error');
            return;
        }
        
        if (!priceInput.value || priceInput.value <= 0) {
            this.showToast('Please enter a valid price', 'error');
            return;
        }
        
        // Get category info including color
        const category = this.data.categories.find(c => c.id === categorySelect.value);
        const categoryName = category ? category.name : categorySelect.value;
        const categoryColor = category?.color || '#D1D5DB';
        
        // Create a custom item
        const customItem = {
            productId: `custom_${Date.now()}`,
            name: categoryName,
            price: parseInt(priceInput.value),
            quantity: 1,
            category: categorySelect.value,
            categoryColor: categoryColor
        };
        
        this.cart.push(customItem);
        
        // Reset form
        categorySelect.value = '';
        priceInput.value = '';
        
        // Open the sidebar when adding item
        this.openCartSidebar();
        this.renderCart();
        this.updateCartSummary();
        this.showToast(`Added custom item to cart`, 'success');
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
            
            // Apply category color as inline style
            const categoryColor = item.categoryColor || '#D1D5DB';
            cartItem.style.borderColor = categoryColor;
            cartItem.style.background = `linear-gradient(135deg, ${this.hexToRgba(categoryColor, 0.15)} 0%, ${this.hexToRgba(categoryColor, 0.05)} 100%)`;
            
            const totalPrice = item.price * item.quantity;
            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">Rs. ${item.price} each</div>
                    <div class="cart-item-total">Total: Rs. ${totalPrice}</div>
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
        
        // Generate order ID and immediately increment counter to prevent duplicates
        const orderNumber = this.data.settings.nextOrderNumber;
        this.data.settings.nextOrderNumber += 1;  // Increment IMMEDIATELY to prevent duplicate IDs
        
        const order = {
            id: `ORD-${String(orderNumber).padStart(3, '0')}`,
            timestamp: new Date().toISOString(),
            items: this.cart.map(item => ({
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                category: item.category
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
    
    formatQuantityDisplay(quantity) {
        // Convert decimal quantities to user-friendly names
        const qty = parseFloat(quantity);
        const quantityNames = {
            0.5: 'half kg',
            1.5: 'dedh kilo',
            2.5: 'dhai kilo',
            3.5: 'saṛhay teen kilo'
        };
        
        if (quantityNames[qty]) {
            return quantityNames[qty];
        }
        
        // For other quantities, return as is
        return `${quantity} kg`;
    }
    
    showReceipt(order) {
        console.log('showReceipt() called for order:', order.id);
        const modal = document.getElementById('receiptModal');
        const receiptContent = document.getElementById('receiptContent');
        
        if (!modal) {
            console.error('receiptModal element not found in DOM');
            return;
        }
        if (!receiptContent) {
            console.error('receiptContent element not found in DOM');
            return;
        }
        
        console.log('Modal elements found, generating receipt HTML');
        
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
                    <span class="col-total">Subt</span>
                </div>
        `;
        
        order.items.forEach(item => {
            const product = this.data.products.find(p => p.id === item.productId);
            let category = product ? this.data.categories.find(c => c.id === product.category) : null;
            
            // For custom items, also find category from item.category
            if (!category && item.category) {
                category = this.data.categories.find(c => c.id === item.category);
            }
            
            // Format item name with unit/quantity
            let displayName = item.name || product?.name || 'Unknown';
            
            // For custom items, calculate kg/unit from price and category basePrice
            if (item.productId?.startsWith('custom_')) {
                if (category && category.basePrice > 0) {
                    const calculatedQty = parseFloat((item.price / category.basePrice).toFixed(2));
                    const unit = category?.unit || 'kg';
                    let qtyDisplay = calculatedQty;
                    
                    // Use user-friendly display for kg quantities
                    if (unit === 'kg') {
                        qtyDisplay = this.formatQuantityDisplay(calculatedQty);
                    } else {
                        const unitLabel = {
                            'gram': 'g',
                            'ml': 'ml',
                            'liter': 'L',
                            'pcs': 'pcs'
                        }[unit] || unit;
                        qtyDisplay = `${calculatedQty} ${unitLabel}`;
                    }
                    displayName = `${displayName} ${qtyDisplay}`;
                }
            } else if (product && product.quantity) {
                // For regular products with quantity, show the quantity with unit
                const unit = category?.unit || 'pcs';
                let qtyDisplay = product.quantity;
                
                // Use user-friendly display for kg quantities
                if (unit === 'kg') {
                    qtyDisplay = this.formatQuantityDisplay(product.quantity);
                } else {
                    const unitLabel = {
                        'gram': 'g',
                        'ml': 'ml',
                        'liter': 'L',
                        'pcs': 'pcs'
                    }[unit] || unit;
                    qtyDisplay = `${product.quantity} ${unitLabel}`;
                }
                displayName = `${product.name} ${qtyDisplay}`;
            }
            
            receiptHTML += `
                <div class="receipt-item">
                    <span class="col-product">${displayName}</span>
                    <span class="col-qty">${item.quantity}</span>
                    <span class="col-price">${item.price}</span>
                    <span class="col-total">${item.price * item.quantity}</span>
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
        console.log('Receipt HTML generated, adding active class to modal');
        modal.classList.add('active');
        console.log('Modal active class added, modal should now be visible');
    }
    
    closeReceiptModal() {
        console.log('closeReceiptModal() called');
        // If user cancels without printing, don't save the order
        this.tempOrder = null;
        const modal = document.getElementById('receiptModal');
        if (modal) {
            console.log('Removing active class from receiptModal');
            modal.classList.remove('active');
        } else {
            console.error('receiptModal element not found');
        }
    }
    
    printReceipt() {
        console.log('printReceipt() called');
        // Validate receipt is ready
        if (!this.tempOrder) {
            console.warn('No tempOrder available');
            this.showToast('No order to print. Please create an order first.', 'error');
            return;
        }
        
        console.log('Proceeding with print for order:', this.tempOrder.id);
        
        // Save the order to database when print is confirmed (only if it's new)
        try {
            // Check if order already exists in database
            const existingOrder = this.data.orders.find(o => o.id === this.tempOrder.id);
            if (!existingOrder) {
                // New order - save it
                this.data.orders.push(this.tempOrder);
                // Note: nextOrderNumber was already incremented in checkout()
                this.saveData();
                
                this.cart = [];
                this.renderCart();
                this.updateCartSummary();
            }
            
            this.showToast(`Order ${this.tempOrder.id} being sent to printer...`, 'info');
            
            // Use the thermal printer settings
            console.log('Calling performPrint()');
            this.performPrint();
            
            // Close modal after printing
            setTimeout(() => {
                console.log('Closing modal after print');
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
        // NEW MONTH-BASED SALES VIEW
        console.log('🔄 renderSales() called - initializing month-based sales view');
        
        // Load settings and metadata
        this.loadDataFromFirebaseOnly().then(() => {
            this.currentSalesStatus = 'completed'; // Set default status
            this.initializeMonthView();
            this.loadSalesForMonth(); // Load current month's sales
            console.log('✓ Sales data initialized for month:', this.formatMonthDisplay(this.activeMonth));
        }).catch(error => {
            console.error('Error loading data for sales:', error);
            // Fallback: still initialize month view with existing data
            this.currentSalesStatus = 'completed';
            this.initializeMonthView();
            this.loadSalesForMonth();
        });
    }
    
    async loadDataFromFirebaseOnly() {
        // This function ONLY loads from Firebase, no localStorage fallback
        console.log('🌐 Attempting to load data directly from Firebase...');
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            const response = await fetch('https://poss-2b64e-default-rtdb.asia-southeast1.firebasedatabase.app/posData.json', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const firebaseData = await response.json();
                if (firebaseData && firebaseData.orders) {
                    this.data = firebaseData;
                    console.log('✓✓✓ Data loaded from Firebase successfully');
                    console.log('Total orders:', this.data.orders.length);
                    console.log('Order statuses:', this.data.orders.map(o => ({ id: o.id, status: o.status })));
                    
                    // Validate that we have categories and products
                    if (!this.data.categories || this.data.categories.length === 0) {
                        this.data.categories = this.getDefaultData().categories;
                    }
                    if (!this.data.products || this.data.products.length === 0) {
                        this.data.products = this.getDefaultData().products;
                    }
                    
                    // Ensure all orders have a status field
                    this.data.orders.forEach(order => {
                        if (!order.status) {
                            order.status = 'completed';
                            console.log(`⚠️ Order ${order.id} missing status, set to completed`);
                        }
                    });
                    
                    // Update localStorage with fresh Firebase data
                    localStorage.setItem('posData', JSON.stringify(this.data));
                    return;
                }
            } else {
                throw new Error(`Firebase returned status ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Failed to load from Firebase:', error.message);
            throw error;
        }
    }
    
    filterSalesByStatus(status) {
        console.log(`📋 filterSalesByStatus called with status: ${status}`);
        this.currentSalesStatus = status;
        
        // Update sub-tab styling using CSS classes
        document.querySelectorAll('.sales-subtab').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`[data-status="${status}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            console.log(`✓ Tab "${status}" marked as active`);
        } else {
            console.warn(`⚠️ Could not find tab button with data-status="${status}"`);
        }
        
        // Call the new month-based filtering
        this.filterSalesWithinMonth();
        this.updateSalesSummary();
        console.log(`✓ filterSalesWithinMonth() and updateSalesSummary() called for status: ${status}`);
    }
    
    filterSales() {
        // NEW MONTH-BASED SALES FILTERING
        // This function is called when rendering sales tab
        // Month-based filtering happens in filterSalesWithinMonth()
        this.loadSalesForMonth();
    }
    
    renderSalesTable(orders) {
        const tbody = document.getElementById('salesTableBody');
        tbody.innerHTML = '';
        
        // Apply status filter
        const currentStatus = this.currentSalesStatus || 'completed';
        const filteredByStatus = orders.filter(order => (order.status || 'completed') === currentStatus);
        
        filteredByStatus.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        filteredByStatus.forEach(order => {
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
        // NEW MONTH-BASED SUMMARY
        // Calculate revenue for current month and currently selected status
        const currentStatus = this.currentSalesStatus || 'completed';
        
        // Get all orders in current month
        let monthOrders = this.data.orders;
        
        // Apply date filter if one is selected
        if (this.selectedDateWithinMonth) {
            const filterDate = new Date(this.selectedDateWithinMonth);
            monthOrders = monthOrders.filter(order => {
                const orderDate = new Date(order.timestamp);
                return orderDate.toDateString() === filterDate.toDateString();
            });
        }
        
        // Filter by status
        const statusFilteredOrders = monthOrders.filter(o => (o.status || 'completed') === currentStatus);
        
        // Only count completed orders for revenue (don't count returned or deleted)
        const completedOrders = currentStatus === 'completed' ? statusFilteredOrders : [];
        const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0);
        const totalOrders = completedOrders.length;
        const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
        
        const periodLabel = this.selectedDateWithinMonth ? 
            `${new Date(this.selectedDateWithinMonth).toLocaleDateString()}` : 
            this.formatMonthDisplay(this.activeMonth);
        
        const summaryContainer = document.getElementById('salesSummary');
        summaryContainer.innerHTML = `
            <div class="summary-card">
                <h3>Total Revenue</h3>
                <div class="value">Rs. ${totalRevenue}</div>
                <div class="change">${periodLabel}</div>
            </div>
            <div class="summary-card">
                <h3>Total Orders</h3>
                <div class="value">${totalOrders}</div>
                <div class="change">${periodLabel}</div>
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
            // Store order for printing
            this.tempOrder = order;
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
            // Switch to returned tab and filter
            this.filterSalesByStatus('returned');
            this.updateAnalytics();
            this.showToast(`Order ${orderId} marked as returned`, 'success');
        }
    }
    
    deleteOrder(orderId) {
        // Find ALL orders with this ID (handle duplicates)
        const orderIndices = this.data.orders
            .map((o, index) => o.id === orderId ? index : -1)
            .filter(index => index !== -1);
        
        if (orderIndices.length === 0) {
            console.warn(`Order ${orderId} not found in orders array`);
            this.showToast(`Order ${orderId} not found`, 'error');
            return;
        }
        
        if (confirm(`Are you sure you want to delete order ${orderId}? This cannot be undone.${orderIndices.length > 1 ? ` (Found ${orderIndices.length} duplicate orders)` : ''}`)) {
            console.log(`🗑️ Deleting ${orderIndices.length} order(s) with ID ${orderId}`);
            
            // Delete all instances of this order
            orderIndices.forEach((index, i) => {
                console.log(`  🗑️ Deleting order at index ${index}:`, this.data.orders[index].id, 'subtotal:', this.data.orders[index].subtotal);
                this.data.orders[index].status = 'deleted';
                this.data.orders[index].deletedAt = new Date().toISOString();
            });
            
            console.log(`✓ All ${orderIndices.length} order(s) marked as deleted`);
            
            this.saveData();
            console.log(`✓ Data saved to Firebase and localStorage`);
            
            // Reload fresh data from Firebase to ensure consistency
            this.loadDataFromFirebaseOnly().then(() => {
                console.log(`✓ Fresh data reloaded from Firebase after deletion`);
                this.filterSalesByStatus('deleted');
                this.updateAnalytics();
                this.showToast(`${orderIndices.length} order(s) with ID ${orderId} moved to deleted section`, 'success');
            }).catch(error => {
                console.error('Failed to reload after deletion:', error);
                // Fallback: just filter without reloading
                this.filterSalesByStatus('deleted');
                this.updateAnalytics();
                this.showToast(`Order ${orderId} marked as deleted (but reload failed)`, 'warning');
            });
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
                basePrice: category.basePrice,
                unit: category.unit,
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
            
            // Format base price display
            let basePriceDisplay = '';
            if (categoryData.basePrice && categoryData.basePrice > 0) {
                const unitLabel = {
                    'pcs': 'pcs',
                    'kg': 'kg',
                    'gram': 'g',
                    'ml': 'ml',
                    'liter': 'L'
                }[categoryData.unit] || categoryData.unit || 'unit';
                basePriceDisplay = ` - Rs. ${categoryData.basePrice}/${unitLabel}`;
            }
            
            categoryHeader.innerHTML = `
                <h3 style="color: ${categoryData.color}; margin: 0;">
                    <i class="fas fa-tag"></i> ${categoryData.name}${basePriceDisplay}
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
                
                // Get category for unit information
                const category = this.data.categories.find(c => c.id === product.category);
                const quantity = product.quantity || 1;
                const categoryColor = category?.color || '#D1D5DB';

                menuItem.style.borderColor = categoryColor;
                menuItem.style.background = `linear-gradient(135deg, ${this.hexToRgba(categoryColor, 0.15)} 0%, ${this.hexToRgba(categoryColor, 0.05)} 100%)`;
                
                // Use user-friendly display for kg quantities
                let qtyDisplay = quantity;
                if (category?.unit === 'kg') {
                    qtyDisplay = this.formatQuantityDisplay(quantity);
                } else {
                    const unitLabel = {
                        'gram': 'g',
                        'ml': 'ml',
                        'liter': 'L',
                        'pcs': 'pcs'
                    }[category?.unit] || category?.unit || 'pcs';
                    qtyDisplay = `${quantity} ${unitLabel}`;
                }
                
                menuItem.innerHTML = `
                    <div class="menu-item-header">
                        <div class="menu-item-info">
                            <h4>${product.name}</h4>
                            <div class="menu-item-description">${qtyDisplay}</div>
                        </div>
                        <div class="menu-item-price">Rs. ${product.price}</div>
                    </div>
                    <div class="menu-item-footer">
                        <div class="menu-item-actions">
                            <button class="btn-secondary btn-small" onclick="if(window.posSystem) posSystem.editProduct('${product.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn-danger btn-small" onclick="if(window.posSystem) posSystem.deleteProduct('${product.id}')">
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
            // Restore quantity for weight-based items
            document.getElementById('productQuantity').value = this.editingProduct.quantity || '';
        } else {
            document.getElementById('productForm').reset();
        }
        
        // Update category display
        this.updateCategoryRateDisplay();
        
        modal.classList.add('active');
    }
    
    updateCategoryRateDisplay() {
        const categoryId = document.getElementById('productCategory').value;
        const quantitySelect = document.getElementById('productQuantity');
        const priceInput = document.getElementById('productPrice');
        
        if (!categoryId) {
            document.getElementById('categoryRateInfo').style.display = 'none';
            document.getElementById('quantitySelectGroup').style.display = 'none';
            document.getElementById('priceFieldGroup').style.display = 'none';
            return;
        }
        
        const category = this.data.categories.find(c => c.id === categoryId);
        if (!category) return;
        
        const unitLabel = {
            'pcs': 'Pieces (pcs)',
            'kg': 'Kilogram (kg)',
            'gram': 'Gram (g)',
            'ml': 'Milliliter (ml)',
            'liter': 'Liter (L)'
        };
        
        document.getElementById('categoryUnitDisplay').textContent = unitLabel[category.unit] || category.unit;
        document.getElementById('categoryRateDisplay').textContent = `Rs. ${category.basePrice}/${category.unit}`;
        document.getElementById('categoryRateInfo').style.display = 'block';
        
        // Show quantity selector for weight-based items (kg, gram, ml, liter)
        if (['kg', 'gram', 'ml', 'liter'].includes(category.unit)) {
            document.getElementById('quantitySelectGroup').style.display = 'block';
            document.getElementById('priceFieldGroup').style.display = 'none';
            quantitySelect.required = true;
            quantitySelect.disabled = false;
            priceInput.required = false;
            // Preserve existing quantity value if editing, otherwise reset
            if (!this.editingProduct || this.editingProduct.quantity === undefined) {
                quantitySelect.value = '';
            }
            document.getElementById('pricePreview').style.display = 'none';
        } else {
            // For pcs, show price field
            document.getElementById('quantitySelectGroup').style.display = 'none';
            document.getElementById('priceFieldGroup').style.display = 'block';
            quantitySelect.required = false;
            quantitySelect.disabled = true;
            priceInput.required = true;
        }
    }
    
    updatePriceDisplay() {
        const categoryId = document.getElementById('productCategory').value;
        const quantity = document.getElementById('productQuantity').value;
        
        if (!categoryId || !quantity) {
            document.getElementById('pricePreview').style.display = 'none';
            return;
        }
        
        const category = this.data.categories.find(c => c.id === categoryId);
        if (!category) return;
        
        const basePrice = category.basePrice || 0;
        const calculatedPrice = Math.round(basePrice * parseFloat(quantity));
        
        document.getElementById('estimatedPrice').textContent = `Rs. ${calculatedPrice}`;
        document.getElementById('pricePreview').style.display = 'block';
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
        
        const categoryId = document.getElementById('productCategory').value;
        const category = this.data.categories.find(c => c.id === categoryId);
        const quantity = document.getElementById('productQuantity').value;
        
        // Calculate price based on category unit and quantity
        let price = 0;
        if (['kg', 'gram', 'ml', 'liter'].includes(category?.unit)) {
            // For weight-based items, use quantity * basePrice
            if (!quantity) {
                this.showToast('Please select a quantity', 'error');
                return;
            }
            price = Math.round((category.basePrice || 0) * parseFloat(quantity));
        } else {
            // For pcs items, use manual price
            price = parseInt(document.getElementById('productPrice').value) || 0;
            if (price <= 0) {
                this.showToast('Please enter a valid price', 'error');
                return;
            }
        }
        
        const productData = {
            name: document.getElementById('productName').value,
            price: price,
            category: categoryId,
            emoji: '', // No emoji icons in cards
            quantity: quantity ? parseFloat(quantity) : undefined // Store quantity for weight items
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
                <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
                <style>
                    /* RESET STYLES */
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    /* PAGE SETUP - 70mm is the safe zone for 80mm printers */
                    @page {
                        size: 72mm auto; /* Force printer to recognize narrower content */
                        margin: 0mm;     /* Remove browser margins */
                    }

                    html, body {
                        width: 54mm;     /* CRITICAL: Constrain content width */
                        max-width: 54mm;
                        margin: 0;
                        background: #fff;
                    }
                    
                    body {
                        font-family: 'Roboto', sans-serif;
                        font-size: 9pt;  /* Slightly smaller font to fit everything */
                        line-height: 1.3;
                        padding: 1mm 2mm 1mm 1mm; /* Right padding ensures it doesn't touch the cut zone */
                        color: #000;
                    }
                    
                    /* HEADER STYLES */
                    .receipt-header {
                        text-align: center;
                        margin-bottom: 2mm;
                        padding-bottom: 2mm;
                        border-bottom: 1px dashed #000;
                    }
                    
                    .receipt-logo {
                        width: 50px; /* Smaller logo */
                        height: auto;
                        margin: 0 auto 1mm;
                        display: block;
                    }
                    
                    .receipt-store-name {
                        font-size: 10pt;
                        font-weight: bold;
                        margin-bottom: 1mm;
                    }
                    
                    .receipt-store-info {
                        font-size: 8pt;
                    }

                    .receipt-title {
                        font-size: 10pt;
                        font-weight: bold;
                        margin-top: 1mm;
                        text-transform: uppercase;
                    }
                    
                    /* META INFO (Date/Invoice) */
                    .receipt-meta {
                        border-bottom: 1px dashed #000;
                        padding-bottom: 1mm;
                        margin-bottom: 1mm;
                        font-size: 8pt;
                    }
                    
                    .receipt-meta-row {
                        display: flex;
                        justify-content: space-between;
                    }
                    
                    /* ITEM TABLE */
                    .receipt-items-header {
                        display: flex;
                        justify-content: space-between;
                        font-weight: bold;
                        border-bottom: 1px dashed #000;
                        padding-bottom: 1mm;
                        margin-bottom: 1mm;
                        font-size: 8pt;
                    }
                    
                    .receipt-item {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 1mm;
                        font-size: 8.5pt;
                    }
                    
                    /* ADJUSTED COLUMNS FOR 70MM WIDTH */
                    .col-product {
                        flex: 1; /* Takes remaining space */
                        text-align: left;
                        padding-right: 1mm;
                        overflow: hidden;
                        text-overflow: ellipsis; 
                    }
                    
                    .col-qty {
                        width: 6mm;  /* Reduced width */
                        text-align: center;
                    }
                    
                    .col-price {
                        width: 13mm; /* Reduced width */
                        text-align: right;
                    }
                    
                    .col-total {
                        width: 14mm;
                        text-align: right;
                    }
                    
                    /* TOTALS SECTION */
                    .receipt-totals {
                        margin-top: 2mm;
                        padding-top: 1mm;
                        border-top: 1px dashed #000;
                    }
                    
                    .receipt-total-line {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 0.5mm;
                        font-size: 9pt;
                    }
                    
                    .receipt-total-line.final {
                        font-weight: bold;
                        font-size: 11pt;
                        margin-top: 1mm;
                        border-top: 1px dashed #000;
                        padding-top: 1mm;
                    }
                    
                    .receipt-footer {
                        text-align: center;
                        font-size: 8pt;
                        margin-top: 3mm;
                    }
                </style>
            </head>
            <body>
                ${receiptHTML}
            </body>
            </html>
        `;
        
        try {
            // Remove existing frame if any
            const existingFrame = document.getElementById('printFrame');
            if (existingFrame && existingFrame.parentNode) {
                existingFrame.parentNode.removeChild(existingFrame);
            }
            
            // Create new print iframe
            const printFrame = document.createElement('iframe');
            printFrame.id = 'printFrame';
            // Hide the iframe
            printFrame.style.position = 'fixed';
            printFrame.style.right = '0';
            printFrame.style.bottom = '0';
            printFrame.style.width = '0';
            printFrame.style.height = '0';
            printFrame.style.border = '0';
            document.body.appendChild(printFrame);
            
            const frameWindow = printFrame.contentWindow;
            const frameDocument = frameWindow?.document;
            
            if (!frameWindow || !frameDocument) {
                this.showToast('Error preparing print frame.', 'error');
                return;
            }
            
            // Write the content
            frameDocument.open();
            frameDocument.write(printDocument);
            frameDocument.close();
            
            // Trigger Print
            const triggerPrint = () => {
                try {
                    frameWindow.focus();
                    frameWindow.print();
                    this.showToast('Sent to Printer...', 'info');
                } catch (err) {
                    console.error('Print error:', err);
                    this.showToast('Error printing receipt.', 'error');
                } finally {
                    // Clean up after 1 second
                    setTimeout(() => {
                        if (printFrame && printFrame.parentNode) {
                            printFrame.parentNode.removeChild(printFrame);
                        }
                    }, 1000);
                }
            };
            
            // Wait for styles to load before printing
            if (frameDocument.readyState === 'complete') {
                setTimeout(triggerPrint, 500);
            } else {
                printFrame.onload = () => setTimeout(triggerPrint, 500);
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
        if (confirm('Are you sure you want to clear all DATA? This cannot be undone.')) {
            if (confirm('This will delete all products, orders, and settings from localStorage. Are you absolutely sure?')) {
                console.log('🗑️ Clearing localStorage and reloading from Firebase...');
                localStorage.removeItem('posData');
                // Reload data from Firebase
                this.loadDataFromFirebaseOnly().then(() => {
                    this.showToast('Data cleared and reloaded from Firebase', 'success');
                    // Refresh current view
                    const activeTab = document.querySelector('.nav-tab.active').dataset.tab;
                    this.switchTab(activeTab);
                }).catch(() => {
                    location.reload();
                });
            }
        }
    }
    
    cleanupDuplicateOrders() {
        // Find and remove duplicate order IDs, keeping only the latest one
        const seenIds = new Set();
        const indicesToRemove = [];
        
        // Iterate in reverse to keep the latest occurrence
        for (let i = this.data.orders.length - 1; i >= 0; i--) {
            const orderId = this.data.orders[i].id;
            if (seenIds.has(orderId)) {
                console.warn(`⚠️ Found duplicate order: ${orderId} at index ${i}, marking for removal`);
                indicesToRemove.push(i);
            } else {
                seenIds.add(orderId);
            }
        }
        
        // Remove duplicates (remove in reverse order to maintain indices)
        if (indicesToRemove.length > 0) {
            console.log(`🧹 Removing ${indicesToRemove.length} duplicate order(s)`);
            indicesToRemove.forEach(index => {
                console.log(`  Removing duplicate: ${this.data.orders[index].id}`);
                this.data.orders.splice(index, 1);
            });
            this.saveData();
            this.showToast(`Cleaned up ${indicesToRemove.length} duplicate orders`, 'success');
            return true;
        } else {
            console.log('✓ No duplicate orders found');
            this.showToast('No duplicate orders found', 'info');
            return false;
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


