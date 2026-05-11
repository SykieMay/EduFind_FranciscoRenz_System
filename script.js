let items = [];
let users = [];
let claims = [];
let messages = [];
let notifications = [];
let ratings = [];

const DB = {
    get(key) {
        if (key === 'users') return users;
        if (key === 'items') return items;
        if (key === 'claims') return claims;
        if (key === 'messages') return messages;
        if (key === 'notifications') return notifications;
        if (key === 'ratings') return ratings;
        return JSON.parse(localStorage.getItem(key) || '[]');
    },
    set(key, value) {
        if (key === 'users') users = value;
        if (key === 'items') items = value;
        if (key === 'claims') claims = value;
        if (key === 'messages') messages = value;
        if (key === 'notifications') notifications = value;
        if (key === 'ratings') ratings = value;
        localStorage.setItem(key, JSON.stringify(value));
    },
    getCurrentUser() {
        return getCurrentUser();
    },
    setCurrentUser(user) {
        setCurrentUser(user);
    },
    clearCurrentUser() {
        localStorage.removeItem('user');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
    }
};

const DEPARTMENT_OPTIONS = [
    'College of Computer Studies',
    'College of Business Administration',
    'College of Education',
    'College of Engineering',
    'College of Hospitality Management',
    'College of Nursing',
    'College of Arts and Sciences',
    'Senior High School',
    'Registrar',
    'Library',
    'Student Affairs',
    'Administration'
];

const ITEM_STATUS_OPTIONS = [
    { value: 'pending', label: 'Pending', icon: 'fa-hourglass-half' },
    { value: 'reported', label: 'Reported', icon: 'fa-bullhorn' },
    { value: 'claimed', label: 'Claimed', icon: 'fa-circle-check' },
    { value: 'found', label: 'Found', icon: 'fa-box-open' }
];

function renderDepartmentOptions(selectedDepartment = '') {
    return `
        <option value="" disabled ${selectedDepartment ? '' : 'selected'}>Choose Department</option>
        ${DEPARTMENT_OPTIONS.map(department => `
            <option value="${department}" ${selectedDepartment === department ? 'selected' : ''}>${department}</option>
        `).join('')}
    `;
}

function renderItemStatusDropdown(item) {
    const currentStatus = item.status || 'pending';
    const selected = ITEM_STATUS_OPTIONS.find(option => option.value === currentStatus) || ITEM_STATUS_OPTIONS[0];

    return `
        <div class="status-dropdown" data-status-menu>
            <button type="button" class="status-dropdown-trigger" onclick="toggleItemStatusDropdown(event, this)" aria-haspopup="listbox" aria-expanded="false">
                <span class="status-dropdown-value">
                    <i class="fas ${selected.icon}"></i>
                    ${selected.label}
                </span>
                <i class="fas fa-chevron-down status-dropdown-caret"></i>
            </button>
            <div class="status-dropdown-menu" role="listbox" aria-label="Item status">
                ${ITEM_STATUS_OPTIONS.map(option => `
                    <button
                        type="button"
                        class="status-dropdown-option ${option.value === currentStatus ? 'selected' : ''}"
                        role="option"
                        aria-selected="${option.value === currentStatus}"
                        onclick="chooseItemStatus(event, ${item.id}, '${option.value}')"
                    >
                        <span><i class="fas ${option.icon}"></i>${option.label}</span>
                        ${option.value === currentStatus ? '<i class="fas fa-check option-check"></i>' : ''}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

window.togglePasswordVisibility = function(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const shouldShow = input.type === 'password';
    input.type = shouldShow ? 'text' : 'password';

    const icon = button?.querySelector('i');
    if (icon) {
        icon.classList.toggle('fa-eye', !shouldShow);
        icon.classList.toggle('fa-eye-slash', shouldShow);
    }

    if (button) {
        const label = shouldShow ? 'Hide password' : 'Show password';
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
    }
};

window.toggleItemStatusDropdown = function(event, trigger) {
    event.stopPropagation();
    const dropdown = trigger.closest('[data-status-menu]');
    const isOpen = dropdown.classList.contains('open');

    document.querySelectorAll('[data-status-menu].open').forEach(menu => {
        menu.classList.remove('open');
        menu.querySelector('.status-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
    });

    if (!isOpen) {
        const menu = dropdown.querySelector('.status-dropdown-menu');
        const triggerRect = trigger.getBoundingClientRect();
        const menuHeight = menu?.scrollHeight || 220;
        const spaceBelow = window.innerHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;

        dropdown.classList.toggle('drop-up', spaceBelow < menuHeight + 18 && spaceAbove > spaceBelow);
        dropdown.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
    }
};

window.chooseItemStatus = function(event, itemId, status) {
    event.stopPropagation();
    document.querySelectorAll('[data-status-menu].open').forEach(menu => {
        menu.classList.remove('open');
        menu.querySelector('.status-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
    });
    updateItemStatus(itemId, status);
};

document.addEventListener('click', () => {
    document.querySelectorAll('[data-status-menu].open').forEach(menu => {
        menu.classList.remove('open');
        menu.querySelector('.status-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
    });
});

// Database Management
const API_URL = window.location.origin;
const ITEM_IMAGE_MAX_DIMENSION = 900;
const ITEM_IMAGE_QUALITY = 0.68;

function compressItemImage(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('Please upload an image file.'));
            return;
        }

        const imageUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            const scale = Math.min(ITEM_IMAGE_MAX_DIMENSION / image.width, ITEM_IMAGE_MAX_DIMENSION / image.height, 1);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));

            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(imageUrl);
            resolve(canvas.toDataURL('image/jpeg', ITEM_IMAGE_QUALITY));
        };

        image.onerror = () => {
            URL.revokeObjectURL(imageUrl);
            reject(new Error('Could not read image.'));
        };

        image.src = imageUrl;
    });
}

function getToken() {
    return localStorage.getItem('token');
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || 'null');
}

function setCurrentUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('currentUser', JSON.stringify(user));
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function confirmAction(message) {
    return confirm(message);
}

function logout() {
    if (!confirmAction('Are you sure you want to log out?')) return;
    localStorage.removeItem('user');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');

    showSection('landing');
}

async function apiFetch(endpoint, options = {}) {

    const token = getToken();

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });

    if (response.status === 401 || response.status === 403) {
        DB.clearCurrentUser();
        showSection('login');
        throw new Error('Unauthorized');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
    }

    return data;
}

window.createUser = async function(userData) {
    const role = userData.role || 'student';
    const institutionId = userData.institutionId || userData.studentId || userData.staffId || '';

    const payload = {
        firstName: (userData.firstName || '').trim(),
        lastName: (userData.lastName || '').trim(),
        middleInitial: (userData.middleInitial || '').trim(),
        email: (userData.email || '').trim(),
        password: userData.password || '',
        department: (userData.department || '').trim(),
        role,
        studentId: role === 'student' ? institutionId.trim() : null,
        staffId: role === 'staff' || role === 'admin' ? institutionId.trim() : null
    };

    if (!payload.firstName || !payload.lastName || !payload.email || !payload.password) {
        throw new Error('First name, last name, email, and password are required');
    }

    if (!payload.studentId && !payload.staffId) {
        throw new Error('Student/Staff ID is required');
    }

    const result = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    await refreshData();
    return result.user;
};

function normalizeItem(item) {
    return {
        ...item,
        reporter: item.reporter || `${item.reporterFirstName || ''} ${item.reporterLastName || ''}`.trim() || 'Unknown',
        date: item.date ? String(item.date).split('T')[0] : ''
    };
}

function normalizeClaim(claim) {
    const relatedItem = items.find(item => item.id === (claim.itemId || claim.item_id));
    const linkedItemStatus = claim.itemStatus || relatedItem?.status;
    const effectiveStatus = claim.status === 'pending' && linkedItemStatus === 'claimed'
        ? 'approved'
        : claim.status;

    return {
        ...claim,
        itemStatus: linkedItemStatus,
        status: effectiveStatus,
        originalStatus: claim.status,
        userId: claim.userId || claim.claimerId,
        userName: claim.userName || `${claim.claimerFirstName || ''} ${claim.claimerLastName || ''}`.trim() || 'Unknown',
        userStudentId: claim.userStudentId || claim.claimerStudentId || claim.claimerStaffId || '',
        date: claim.date || (claim.timestamp ? new Date(Number(claim.timestamp)).toISOString().split('T')[0] : ''),
        answer: claim.answer || claim.verificationAnswer,
        description: claim.description || claim.verificationAnswer || '',
        aiMatch: claim.aiMatch ?? true
    };
}

function normalizeMessage(message) {
    return {
        ...message,
        from: message.from || message.senderId,
        to: message.to || message.receiverId,
        time: message.time || message.timestamp,
        read: Boolean(message.read)
    };
}

async function refreshData() {
    ratings = JSON.parse(localStorage.getItem('ratings') || '[]');

    if (!getToken()) return;

    const [me, fetchedUsers, fetchedItems, fetchedClaims, fetchedNotifications, fetchedMessages] = await Promise.all([
        apiFetch('/api/users/me'),
        apiFetch('/api/users'),
        apiFetch('/api/items'),
        apiFetch('/api/claims'),
        apiFetch('/api/notifications'),
        apiFetch('/api/messages')
    ]);

    setCurrentUser(me);
    users = fetchedUsers.map(u => ({ rating: 5, ratingCount: 0, warnings: 0, profilePicture: null, ...u }));
    if (!users.some(u => u.id === me.id)) users.push(me);
    items = fetchedItems.map(normalizeItem);
    claims = fetchedClaims.map(normalizeClaim);
    notifications = fetchedNotifications;
    messages = fetchedMessages.map(normalizeMessage);
}

// --- Initial Data Seeding ---
function cleanOldItems() {
    // let items = DB.get('items');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const initialCount = items.length;
    // Auto-Delete reported items that are not found or claimed after 30 days
    // Logic: If status is 'pending' or 'reported' (not 'found' or 'claimed') 
    // AND date is older than 30 days.
    items = items.filter(item => {
        const itemDate = new Date(item.date);
        const isOld = itemDate < thirtyDaysAgo;
        const isNotRecovered = (item.status === 'pending' || item.status === 'reported');
        
        // If it's old and not recovered, delete it (return false for filter)
        return !(isOld && isNotRecovered);
    });
    
    if (items.length < initialCount) {
        // DB.set('items', items);
        console.log(`Auto-deleted ${initialCount - items.length} old unclaimed items.`);
    }
}

// function seedData() {
//     const users = DB.get('users');
//     if (users.length === 0) {
//         const defaultUsers = [
//             { id: 1, firstName: 'Admin', lastName: 'User', middleInitial: 'A', staffId: 'ADM001', email: 'admin@test.com', password: '123', role: 'admin', rating: 5, ratingCount: 0, warnings: 0, profilePicture: null },
//             { id: 2, firstName: 'Staff', lastName: 'Member', middleInitial: 'S', staffId: 'STF001', email: 'staff@test.com', password: '123', role: 'staff', rating: 5, ratingCount: 0, warnings: 0, profilePicture: null },
//             { id: 3, firstName: 'Student', lastName: 'User', middleInitial: 'J', studentId: 'STU001', department: 'Computer Science', email: 'student@test.com', password: '123', role: 'student', rating: 5, ratingCount: 0, warnings: 0, profilePicture: null }
//         ];
//         DB.set('users', defaultUsers);
//     }
//     const items = DB.get('items');
//     if (items.length === 0) {
//         const defaultItems = [
//             { id: 1, title: 'iPhone 13 Pro', description: 'Blue color, found near library', type: 'found', status: 'pending', date: '2026-04-20', reporter: 'Staff Member', reporterId: 2, reporterStudentId: 'STF001', category: 'Electronics', image: null, verificationQuestion: 'What is the wallpaper?', verificationAnswer: 'Golden Gate Bridge' },
//             { id: 2, title: 'Water Bottle', description: 'Hydro Flask, black', type: 'lost', status: 'pending', date: '2026-04-21', reporter: 'Student User', reporterId: 3, reporterStudentId: 'STU001', category: 'Personal', image: null }
//         ];
//         DB.set('items', defaultItems);
//     }
//     if (!localStorage.getItem('claims')) DB.set('claims', []);
//     if (!localStorage.getItem('messages')) DB.set('messages', []);
//     if (!localStorage.getItem('notifications')) DB.set('notifications', []);
//     if (!localStorage.getItem('ratings')) DB.set('ratings', []);
// }

// --- Navigation ---
window.showSection = function(sectionId) {
    const sections = ['landing-section', 'login-section', 'dashboard-section'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(`${sectionId}-section`);
    if (target) target.classList.remove('hidden');
    const navbar = document.getElementById('navbar');
    if (sectionId === 'dashboard') {
        if (navbar) navbar.classList.add('hidden');
        loadDashboard();
    } else {
        if (navbar) navbar.classList.remove('hidden');
    }
    window.scrollTo(0, 0);
};

window.scrollToSection = function(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
};

window.toggleAuth = function(type) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const forgotForm = document.getElementById('forgot-password-form');
    if (type === 'login') {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        if (forgotForm) forgotForm.classList.add('hidden');
    } else if (type === 'forgot') {
        loginForm.classList.add('hidden');
        signupForm.classList.add('hidden');
        if (forgotForm) forgotForm.classList.remove('hidden');
    } else {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        if (forgotForm) forgotForm.classList.add('hidden');
    }
};

// --- Notification Badge Management ---
function updateNotificationBadge() {
    const user = DB.getCurrentUser();
    if (!user) return;
    
    // const notifications = DB.get('notifications') || [];
    const unreadCount = notifications.filter(n => !n.read && n.userId === user.id).length;
    const badge = document.getElementById('notification-badge');
    
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.classList.remove('hidden');
            badge.classList.add('success');
        } else {
            badge.classList.add('hidden');
        }
    }
}

function addNotification(userId, type, title, message, itemId = null) {
    const notification = {
        id: Date.now(),
        userId: userId,
        itemId: itemId,
        type: type,
        title: title,
        message: message,
        read: false,
        timestamp: Date.now()
    };

    notifications.push(notification);
    if (getToken()) {
        apiFetch('/api/notifications', {
            method: 'POST',
            body: JSON.stringify({ userId, itemId, type, title, message })
        }).catch(error => console.error('Failed to save notification:', error));
    }
    updateNotificationBadge();
}

// --- Dashboard Logic ---
function updateManagementLinks() {
    const user = DB.getCurrentUser();
    const adminLink = document.getElementById('admin-link');
    const staffLink = document.getElementById('staff-link');

    if (!adminLink || !staffLink) return;

    adminLink.classList.add('hidden');
    staffLink.classList.add('hidden');

    if (user?.role === 'admin') {
        adminLink.classList.remove('hidden');
    } else if (user?.role === 'staff') {
        staffLink.classList.remove('hidden');
    }
}

async function loadDashboard() {
    const user = DB.getCurrentUser();
    if (!user) {
        showSection('login');
        return;
    }
    try {
        await refreshData();
        updateUserHeader();
        updateManagementLinks();
        updateNotificationBadge();
        updateMessageBadge();
    } catch (error) {
        console.error(error);
        showToast('Failed to load dashboard data.', 'error');
    }

    updateManagementLinks();
    
    showDashboardTab('overview');
}

function updateUserHeader() {
    const user = DB.getCurrentUser();
    // const users = DB.get('users');
    const dbUser = users.find(u => u.id === user.id) || user;
    
    document.getElementById('user-display-name').textContent = `${dbUser.firstName} ${dbUser.lastName}`;
    const avatarEl = document.getElementById('user-avatar');
    if (dbUser.profilePicture) {
        avatarEl.innerHTML = `<img src="${dbUser.profilePicture}" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;">`;
    } else {
        avatarEl.textContent = (dbUser.firstName[0] + dbUser.lastName[0]).toUpperCase();
    }
}

window.showDashboardTab = async function(tab) {
    const user = DB.getCurrentUser();
    const title = document.getElementById('tab-title');
    if (!user || !title) return;

    try {
        await refreshData();
    } catch (error) {
        console.error(error);
    }
    
    document.querySelectorAll('.sidebar-nav a').forEach(a => {
        a.classList.remove('active');
        if (a.getAttribute('data-tab') === tab) a.classList.add('active');
    });

    // Ensure badges are updated on every tab switch
    updateNotificationBadge();
    updateMessageBadge();

    switch(tab) {
        case 'overview': title.textContent = 'Dashboard Overview'; renderOverview(); break;
        case 'report': title.textContent = 'Report New Item'; renderReportForm(); break;
        case 'items': title.textContent = 'Browse Items'; renderItemsList(); break;
        case 'claims': title.textContent = 'Claims Management'; renderClaims(); break;
        case 'transactions': title.textContent = 'Transaction History'; renderTransactions(); break;
        case 'search': title.textContent = 'Search Users'; renderUserSearch(); break;
        case 'staff': title.textContent = 'Create User'; renderStaffPanel(); break;
        case 'admin': title.textContent = 'Create User'; renderAdminPanel(); break;
        case 'messages': title.textContent = 'Messages'; renderMessages(); break;
        case 'notifications': title.textContent = 'Notifications'; renderNotificationsPage(); break;
        case 'profile': title.textContent = 'My Profile'; renderProfile(); break;
    }
};

// --- Render Functions ---
function getRoleDashboardConfig(user, counts) {
    const role = user.role || 'student';
    const configs = {
        admin: {
            eyebrow: 'Admin overview',
            title: `Welcome back, ${user.firstName}.`,
            summary: `There are ${counts.pendingClaims} pending claims, ${counts.pendingItems} active item reports, and ${counts.totalUsers} registered users in EduFind.`,
            icon: 'fa-user-shield',
            primaryAction: { label: 'Create User', tab: 'admin', icon: 'fa-user-plus' },
            secondaryAction: { label: 'Review Claims', tab: 'claims', icon: 'fa-clipboard-check' }
        },
        staff: {
            eyebrow: 'Staff workspace',
            title: `Good day, ${user.firstName}.`,
            summary: `Focus on ${counts.pendingClaims} pending claims, ${counts.pendingItems} open reports, and ${counts.unreadCount} unread notifications.`,
            icon: 'fa-clipboard-list',
            primaryAction: { label: 'Create Student', tab: 'staff', icon: 'fa-user-plus' },
            secondaryAction: { label: 'Browse Items', tab: 'items', icon: 'fa-list' }
        },
        student: {
            eyebrow: 'Student dashboard',
            title: `Hi, ${user.firstName}.`,
            summary: `You have ${counts.myItems} item reports, ${counts.myClaims} submitted claims, and ${counts.unreadCount} unread notifications.`,
            icon: 'fa-graduation-cap',
            primaryAction: { label: 'Report Item', tab: 'report', icon: 'fa-plus-circle' },
            secondaryAction: { label: 'Browse Items', tab: 'items', icon: 'fa-search' }
        }
    };

    return configs[role] || configs.student;
}

function renderOverviewMetricCard(metric) {
    const action = metric.filter
        ? `openOverviewItemFilter('${metric.filter}')`
        : metric.tab
            ? `showDashboardTab('${metric.tab}')`
            : '';
    const keyAction = metric.filter
        ? `handleStatCardKey(event, '${metric.filter}')`
        : metric.tab
            ? `handleMetricTabKey(event, '${metric.tab}')`
            : '';
    const clickAttrs = action
        ? `onclick="${action}" role="button" tabindex="0" onkeydown="${keyAction}"`
        : '';
    const clickableClass = action ? 'stat-card-clickable' : '';

    return `
        <div class="glass-card stat-card dashboard-metric ${clickableClass}" ${clickAttrs}>
            <div class="metric-icon ${metric.tone || ''}"><i class="fas ${metric.icon}"></i></div>
            <div>
                <h3>${metric.label}</h3>
                <div class="value">${metric.value}</div>
                <p>${metric.helper}</p>
                ${action ? '<small class="metric-action-hint">Open section</small>' : ''}
            </div>
        </div>
    `;
}

function renderOverviewItemRow(item) {
    if (!item) return '';
    const reporter = users.find(u => u.id === item.reporterId);
    const reporterName = reporter ? `${reporter.firstName} ${reporter.lastName}` : (item.reporter || 'Unknown reporter');
    const status = item.status || item.type || 'pending';
    return `
        <button class="overview-list-row" onclick="viewItemDetails(${item.id})">
            <span class="overview-row-icon ${item.type}"><i class="fas ${item.type === 'lost' ? 'fa-magnifying-glass' : 'fa-hand-holding-heart'}"></i></span>
            <span>
                <strong>${item.title}</strong>
                <small>${reporterName} • ${item.category || 'Uncategorized'}</small>
            </span>
            <span class="status-badge item-status-chip ${getStatusClass(status)}">${formatStatusLabel(status)}</span>
        </button>
    `;
}

function renderOverviewClaimRow(claim) {
    if (!claim) return '';
    const status = claim.status || 'pending';
    return `
        <button class="overview-list-row" onclick="viewClaimDetails(${claim.id})">
            <span class="overview-row-icon warning"><i class="fas fa-file-signature"></i></span>
            <span>
                <strong>${claim.itemTitle || 'Item claim'}</strong>
                <small>${claim.userName || 'Claimant'} • ${claim.date || 'No date'}</small>
            </span>
            <span class="status-badge claim-status ${getStatusClass(status)}">${formatStatusLabel(status)}</span>
        </button>
    `;
}

function renderOverview() {
    const user = DB.getCurrentUser();
    const lostCount = items.filter(i => i.type === 'lost').length;
    const foundCount = items.filter(i => i.type === 'found').length;
    const claimedCount = items.filter(i => i.status === 'claimed').length;
    const pendingItems = items.filter(i => i.status === 'pending' || i.status === 'reported');
    const pendingClaims = claims.filter(c => c.status === 'pending');
    const myItems = items.filter(i => i.reporterId === user.id);
    const myClaims = claims.filter(c => c.userId === user.id);
    const myItemIds = myItems.map(i => i.id);
    const claimsOnMyItems = claims.filter(c => myItemIds.includes(c.itemId));
    const unreadCount = notifications.filter(n => !n.read && n.userId === user.id).length;
    const unreadMessages = messages.filter(m => m.to === user.id && !m.read).length;
    const counts = {
        totalUsers: users.length,
        pendingClaims: pendingClaims.length,
        pendingItems: pendingItems.length,
        myItems: myItems.length,
        myClaims: myClaims.length,
        unreadCount
    };
    const config = getRoleDashboardConfig(user, counts);
    const role = user.role || 'student';
    const visibleItems = role === 'student'
        ? items.filter(item => item.reporterId === user.id || myClaims.some(claim => claim.itemId === item.id))
        : items;
    const recentItems = [...visibleItems].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 4);
    const recentClaims = role === 'student' ? myClaims.slice(-4).reverse() : pendingClaims.slice(0, 4);
    const metricsByRole = {
        admin: [
            { label: 'Users', value: users.length, helper: 'Registered accounts', icon: 'fa-users', tone: 'accent', tab: 'admin' },
            { label: 'Lost Items', value: lostCount, helper: 'Open lost reports', icon: 'fa-magnifying-glass', tone: 'warning', filter: 'lost' },
            { label: 'Found Items', value: foundCount, helper: 'Possible returns', icon: 'fa-box-open', tone: 'success', filter: 'found' },
            { label: 'Claimed', value: claimedCount, helper: 'Completed recoveries', icon: 'fa-circle-check', tone: 'primary', filter: 'claimed' }
        ],
        staff: [
            { label: 'Pending Claims', value: pendingClaims.length, helper: 'Need review', icon: 'fa-file-signature', tone: 'warning', tab: 'claims' },
            { label: 'Found Items', value: foundCount, helper: 'Ready for owners', icon: 'fa-box-open', tone: 'success', filter: 'found' },
            { label: 'My Reports', value: myItems.length, helper: 'Items you logged', icon: 'fa-clipboard-list', tone: 'primary', tab: 'items' },
            { label: 'Alerts', value: unreadCount, helper: 'Unread notifications', icon: 'fa-bell', tone: 'accent', tab: 'notifications' }
        ],
        student: [
            { label: 'My Reports', value: myItems.length, helper: 'Lost or found posts', icon: 'fa-clipboard-list', tone: 'primary', tab: 'items' },
            { label: 'My Claims', value: myClaims.length, helper: 'Submitted requests', icon: 'fa-hand-holding', tone: 'accent', tab: 'claims' },
            { label: 'Messages', value: unreadMessages, helper: 'Unread conversations', icon: 'fa-comments', tone: 'success', tab: 'messages' },
            { label: 'Notifications', value: unreadCount, helper: 'Updates waiting', icon: 'fa-bell', tone: 'warning', tab: 'notifications' }
        ]
    };

    updateNotificationBadge();

    document.getElementById('dashboard-content').innerHTML = `
        <section class="dashboard-overview">
            <div class="overview-hero glass-card">
                <div class="overview-hero-copy">
                    <span class="overview-eyebrow">${config.eyebrow}</span>
                    <h2>${config.title}</h2>
                    <p>${config.summary}</p>
                    <div class="overview-actions">
                        <button onclick="showDashboardTab('${config.primaryAction.tab}')" class="btn btn-primary"><i class="fas ${config.primaryAction.icon}"></i> ${config.primaryAction.label}</button>
                        <button onclick="showDashboardTab('${config.secondaryAction.tab}')" class="btn btn-outline"><i class="fas ${config.secondaryAction.icon}"></i> ${config.secondaryAction.label}</button>
                    </div>
                </div>
                <div class="overview-hero-panel">
                    <i class="fas ${config.icon}"></i>
                    <strong>${role.toUpperCase()}</strong>
                    <span>${user.department || user.studentId || user.staffId || 'EduFind account'}</span>
                </div>
            </div>

            <div class="stats-grid overview-metrics">
                ${metricsByRole[role].map(renderOverviewMetricCard).join('')}
            </div>

            <div class="overview-grid">
                <div class="glass-card overview-panel">
                    <div class="overview-panel-header">
                        <div>
                            <span>Activity</span>
                            <h3>${role === 'student' ? 'Your recent items' : 'Recent item reports'}</h3>
                        </div>
                        <button onclick="showDashboardTab('items')" class="btn btn-outline btn-icon"><i class="fas fa-arrow-right"></i></button>
                    </div>
                    <div class="overview-list">
                        ${recentItems.length ? recentItems.map(renderOverviewItemRow).join('') : '<p class="overview-empty">No item activity yet.</p>'}
                    </div>
                </div>

                <div class="glass-card overview-panel">
                    <div class="overview-panel-header">
                        <div>
                            <span>Claims</span>
                            <h3>${role === 'student' ? 'Your claim status' : 'Claim review queue'}</h3>
                        </div>
                        <button onclick="showDashboardTab('claims')" class="btn btn-outline btn-icon"><i class="fas fa-arrow-right"></i></button>
                    </div>
                    <div class="overview-list">
                        ${recentClaims.length ? recentClaims.map(renderOverviewClaimRow).join('') : '<p class="overview-empty">No claims to show.</p>'}
                    </div>
                </div>
            </div>
        </section>
    `;
}

window.handleStatCardKey = function(event, filterType) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openOverviewItemFilter(filterType);
    }
};

window.handleMetricTabKey = function(event, tab) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showDashboardTab(tab);
    }
};

window.openOverviewItemFilter = async function(filterType) {
    window.pendingItemsFilter = filterType;
    await showDashboardTab('items');
};

function renderReportForm() {
    const user = DB.getCurrentUser();
    document.getElementById('dashboard-content').innerHTML = `
        <section class="form-workspace report-workspace">
            <div class="glass-card form-intro-panel">
                <span class="overview-eyebrow">Item intake</span>
                <h3>Submit a clear report</h3>
                <p>Use specific titles, locations, dates, and identifying details so staff can match claims faster.</p>
                <div class="form-help-list">
                    <div><i class="fas fa-camera"></i><span>Add a photo when available.</span></div>
                    <div><i class="fas fa-shield-halved"></i><span>Found items can include a verification question.</span></div>
                    <div><i class="fas fa-bell"></i><span>Owners and staff receive updates from the dashboard.</span></div>
                </div>
            </div>

            <div class="glass-card p-40 form-main-card">
                <form id="report-form">
                    <div class="form-section-title">
                        <div>
                            <span>Report details</span>
                            <h3>What item are you reporting?</h3>
                        </div>
                        <i class="fas fa-clipboard-list"></i>
                    </div>
                    <div class="form-grid two">
                        <div class="input-group"><label>Item Title</label><input type="text" id="item-title" class="glass-input" placeholder="e.g. Black wallet, blue ID lace" required><i class="fas fa-tag"></i></div>
                    <div class="input-group">
                        <label>Report Type</label>
                        <select id="item-type" class="glass-input" required>
                            <option value="lost">I Lost This</option>
                            <option value="found">I Found This</option>
                        </select>
                        <i class="fas fa-exchange-alt"></i>
                    </div>
                </div>
                <div class="input-group">
                    <label>Detailed Description</label>
                    <textarea id="item-description" class="glass-input" placeholder="Color, brand, marks, last known location, or anything unique." rows="5" required></textarea>
                    <i class="fas fa-align-left"></i>
                </div>
                <div class="input-group">
                    <label>Category</label>
                    <select id="item-category" class="glass-input" required>
                        <option value="">Select Category</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Personal">Personal Items</option>
                        <option value="Documents">Documents</option>
                        <option value="Books">Books</option>
                        <option value="Others">Others</option>
                    </select>
                    <i class="fas fa-layer-group"></i>
                </div>
                
                <div id="found-verification" class="verification-panel hidden">
                    <div class="form-section-title compact">
                        <div>
                            <span>Secure verification</span>
                            <h3>Question for found items</h3>
                        </div>
                        <i class="fas fa-shield-alt"></i>
                    </div>
                    <p>Create a question that only the rightful owner can answer.</p>
                    <div class="form-grid two">
                        <div class="input-group"><label>Verification Question</label><input type="text" id="verification-question" class="glass-input" placeholder="e.g. What sticker is on the laptop?"><i class="fas fa-question-circle"></i></div>
                        <div class="input-group"><label>Correct Answer</label><input type="text" id="verification-answer" class="glass-input" placeholder="Owner-only answer"><i class="fas fa-key"></i></div>
                    </div>
                </div>

                <div class="file-upload-wrapper">
                    <label class="file-upload-label" for="item-image">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <span>Click to upload item image</span>
                        <small>PNG, JPG, or camera photo</small>
                    </label>
                    <input type="file" id="item-image" hidden accept="image/*">
                </div>
                <button type="submit" class="btn btn-primary w-100 form-submit-btn"><i class="fas fa-paper-plane"></i> Submit Report</button>
            </form>
        </div>
        </section>
    `;

    const typeSelect = document.getElementById('item-type');
    const verificationDiv = document.getElementById('found-verification');
    const imageInput = document.getElementById('item-image');
    const imageLabel = document.querySelector('.file-upload-label span');
    typeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'found') verificationDiv.classList.remove('hidden');
        else verificationDiv.classList.add('hidden');
    });
    imageInput.addEventListener('change', () => {
        imageLabel.textContent = imageInput.files[0] ? imageInput.files[0].name : 'Click to upload item image';
    });

    document.getElementById('report-form').addEventListener('submit', async (e) => { 
    e.preventDefault();

    if (!confirmAction('Submit this item report now?')) return;

    const user = DB.getCurrentUser();

    const newItem = {
        id: Date.now(),
        title: document.getElementById('item-title').value,
        type: document.getElementById('item-type').value,
        description: document.getElementById('item-description').value,
        category: document.getElementById('item-category').value,
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
        reporter: `${user.firstName} ${user.lastName}`,
        reporterId: user.id,
        reporterStudentId: user.role === 'student' ? user.studentId : user.staffId,
        verificationQuestion: document.getElementById('verification-question').value,
        verificationAnswer: document.getElementById('verification-answer').value,
        image: null
    };

    const file = document.getElementById('item-image').files[0];

    try {

        if (file) {
            newItem.image = await compressItemImage(file);

            await apiFetch('/api/items', {
                method: 'POST',
                body: JSON.stringify(newItem)
            });
            await refreshData();

            showToast('Item reported successfully!', 'success');

            showDashboardTab('items');

        } else {

            await apiFetch('/api/items', {
                method: 'POST',
                body: JSON.stringify(newItem)
            });
            await refreshData();

            showToast('Item reported successfully!', 'success');

            showDashboardTab('items');
        }

    } catch (error) {

        console.error(error);

        showToast('Failed to report item.', 'error');

    }
});
}

function getBrowseFilteredItems(filterType = 'all') {
    let filtered = [...items];

    if (filterType === 'lost') {
        filtered = items.filter(i => i.type === 'lost');
    } else if (filterType === 'found') {
        filtered = items.filter(i => i.type === 'found');
    } else if (filterType === 'claimed') {
        filtered = items.filter(i => i.status === 'claimed');
    } else if (filterType === 'newest') {
        filtered = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (filterType === 'oldest') {
        filtered = [...items].sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    return filtered;
}

function renderBrowseItemCard(item) {
    const currentUser = DB.getCurrentUser();
    const reporter = users.find(u => u.id === item.reporterId);
    const reporterName = reporter ? `${reporter.firstName} ${reporter.lastName}` : (item.reporter || 'Unknown reporter');
    const statusLabel = item.status || 'pending';
    const canReviewItem = ['admin', 'staff'].includes(currentUser?.role) && statusLabel === 'pending';
    const imageMarkup = item.image
        ? `<img src="${item.image}" class="item-card-img" alt="${item.title}">`
        : `<div class="item-card-img item-card-placeholder"><i class="fas fa-image"></i><span>No image</span></div>`;
    const adminReviewMarkup = canReviewItem ? `
        <div class="admin-card-actions">
            <button onclick="reviewItemReport(${item.id}, 'confirm')" class="btn btn-primary confirm-report-btn">
                <i class="fas fa-check"></i> Confirm
            </button>
            <button onclick="reviewItemReport(${item.id}, 'reject')" class="btn btn-outline reject-report-btn">
                <i class="fas fa-times"></i> Reject
            </button>
        </div>
    ` : '';

    return `
        <article class="glass-card item-card browse-item-card" data-category="${item.category || ''}">
            <div class="item-media-wrap">
                ${imageMarkup}
                <span class="status-badge ${item.type} item-type-chip">${item.type}</span>
            </div>
            <div class="item-card-body">
                <div class="item-card-meta">
                    <span><i class="fas fa-calendar"></i>${item.date || 'No date'}</span>
                    <span class="status-badge item-status-chip ${getStatusClass(statusLabel)}">${formatStatusLabel(statusLabel)}</span>
                </div>
                <h3>${item.title}</h3>
                <p>${item.description || 'No description provided.'}</p>
                <div class="item-card-details">
                    <span><i class="fas fa-layer-group"></i>${item.category || 'Uncategorized'}</span>
                    <span><i class="fas fa-user"></i>${reporterName}</span>
                </div>
                ${adminReviewMarkup}
                <button onclick="viewItemDetails(${item.id})" class="btn btn-outline item-details-btn"><i class="fas fa-eye"></i> View Details</button>
            </div>
        </article>
    `;
}

function renderBrowseItemsResults(filteredItems) {
    const itemsContainer = document.getElementById('items-results');
    const countEl = document.getElementById('items-result-count');
    if (!itemsContainer) return;

    countEl.textContent = `${filteredItems.length} ${filteredItems.length === 1 ? 'item' : 'items'}`;
    itemsContainer.innerHTML = filteredItems.length
        ? filteredItems.map(renderBrowseItemCard).join('')
        : `
            <div class="glass-card browse-empty-state">
                <i class="fas fa-box-open"></i>
                <h3>No items found</h3>
                <p>Try a different search, category, or status filter.</p>
                <button onclick="filterItemsByType('all')" class="btn btn-primary">Show All Items</button>
            </div>
        `;
}

function applyBrowseFilters() {
    const searchInput = document.getElementById('items-search');
    const categoryFilter = document.getElementById('category-filter');
    const term = (searchInput?.value || '').toLowerCase();
    const category = categoryFilter?.value || 'all';
    const baseItems = getBrowseFilteredItems(window.currentItemsFilter || 'all');
    const filtered = baseItems.filter(item => {
        const haystack = `${item.title || ''} ${item.description || ''} ${item.category || ''} ${item.type || ''} ${item.status || ''}`.toLowerCase();
        const matchesSearch = !term || haystack.includes(term);
        const matchesCategory = category === 'all' || item.category === category;
        return matchesSearch && matchesCategory;
    });

    renderBrowseItemsResults(filtered);
}

function renderItemsList() {
    const user = DB.getCurrentUser();
    const initialFilter = window.pendingItemsFilter || 'all';
    window.pendingItemsFilter = null;
    window.currentItemsFilter = initialFilter;
    const lostCount = items.filter(i => i.type === 'lost').length;
    const foundCount = items.filter(i => i.type === 'found').length;
    const claimedCount = items.filter(i => i.status === 'claimed').length;

    document.getElementById('dashboard-content').innerHTML = `
        <section class="browse-workspace">
            <div class="browse-summary glass-card">
                <div>
                    <span class="overview-eyebrow">Inventory</span>
                    <h3>Browse reported items</h3>
                    <p>Search and filter lost, found, and claimed items from one clean queue.</p>
                </div>
                <div class="browse-summary-stats">
                    <div><strong>${items.length}</strong><span>Total</span></div>
                    <div><strong>${lostCount}</strong><span>Lost</span></div>
                    <div><strong>${foundCount}</strong><span>Found</span></div>
                    <div><strong>${claimedCount}</strong><span>Claimed</span></div>
                </div>
            </div>

            <div class="browse-toolbar glass-card">
                <div class="browse-search">
                    <i class="fas fa-search search-icon"></i>
                    <input type="text" id="items-search" class="search-input" placeholder="Search by title, description, category, or status..." style="padding-left: 44px;">
                </div>
                <select id="category-filter" class="search-input browse-category-select">
                    <option value="all">All Categories</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Personal">Personal Items</option>
                    <option value="Documents">Documents</option>
                    <option value="Books">Books</option>
                    <option value="Others">Others</option>
                </select>
            </div>

            <div class="browse-filter-row">
                <button onclick="filterItemsByType('all')" class="btn btn-primary filter-type-btn" data-type="all"><i class="fas fa-border-all"></i> All Items</button>
                <button onclick="filterItemsByType('newest')" class="btn btn-outline filter-type-btn" data-type="newest"><i class="fas fa-arrow-down-wide-short"></i> Newest</button>
                <button onclick="filterItemsByType('oldest')" class="btn btn-outline filter-type-btn" data-type="oldest"><i class="fas fa-arrow-up-wide-short"></i> Oldest</button>
                <button onclick="filterItemsByType('lost')" class="btn btn-outline filter-type-btn" data-type="lost"><i class="fas fa-magnifying-glass"></i> Lost Items</button>
                <button onclick="filterItemsByType('found')" class="btn btn-outline filter-type-btn" data-type="found"><i class="fas fa-box-open"></i> Found Items</button>
                ${user.role === 'admin' ? `<button onclick="filterItemsByType('claimed')" class="btn btn-outline filter-type-btn" data-type="claimed"><i class="fas fa-circle-check"></i> Claimed</button>` : ''}
                <span id="items-result-count" class="browse-result-count">0 items</span>
            </div>

            <div class="items-grid browse-items-grid" id="items-results"></div>
        </section>
    `;

    document.getElementById('items-search').addEventListener('input', applyBrowseFilters);
    document.getElementById('category-filter').addEventListener('change', applyBrowseFilters);
    filterItemsByType(initialFilter);
}

window.filterItemsByType = function(filterType) {
    window.currentItemsFilter = filterType;
    document.querySelectorAll('.filter-type-btn').forEach(btn => {
        const isActive = btn.getAttribute('data-type') === filterType;
        btn.classList.toggle('btn-primary', isActive);
        btn.classList.toggle('btn-outline', !isActive);
    });

    applyBrowseFilters();
};

window.deleteItem = async function(itemId) {
    if (!confirmAction('Are you sure you want to delete this item? This action cannot be undone.')) return;

    try {
        await apiFetch(`/api/items/${itemId}`, { method: 'DELETE' });
        await refreshData();
        document.querySelectorAll('.modal').forEach(m => m.remove());
        showToast('Item deleted successfully.', 'info');
        renderItemsList();
    } catch (error) {
        console.error(error);
        showToast('Failed to delete item.', 'error');
    }
};

window.reviewItemReport = async function(itemId, action) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    if (action === 'confirm') {
        if (!confirmAction(`Confirm "${item.title}" as a reviewed item report?`)) return;

        try {
            await apiFetch(`/api/items/${itemId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'reported' })
            });
            await refreshData();
            addNotification(item.reporterId, 'info', 'Item Report Confirmed', `Your item report "${item.title}" has been confirmed.`, item.id);
            showToast('Item report confirmed.', 'success');
            renderItemsList();
        } catch (error) {
            console.error(error);
            showToast('Failed to confirm report.', 'error');
        }
        return;
    }

    if (action === 'reject') {
        if (!confirmAction(`Reject and remove "${item.title}"? This cannot be undone.`)) return;

        try {
            await apiFetch(`/api/items/${itemId}`, { method: 'DELETE' });
            await refreshData();
            addNotification(item.reporterId, 'info', 'Item Report Rejected', `Your item report "${item.title}" was rejected by the admin.`, item.id);
            showToast('Item report rejected.', 'info');
            renderItemsList();
        } catch (error) {
            console.error(error);
            showToast('Failed to reject report.', 'error');
        }
    }
};

window.updateItemStatus = async function(itemId, newStatus) {
    // let items = DB.get('items');
    const item = items.find(i => i.id === itemId);
    if (item) {
        if (item.status === newStatus) return;
        if (!confirmAction(`Change "${item.title}" status from ${item.status} to ${newStatus}?`)) {
            document.querySelectorAll('.modal').forEach(m => m.remove());
            viewItemDetails(itemId);
            return;
        }

        try {
            await apiFetch(`/api/items/${itemId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            await refreshData();
            showToast(`Status updated to ${newStatus}`, 'success');

            // Refresh modal content to show new status
            document.querySelectorAll('.modal').forEach(m => m.remove());
            viewItemDetails(itemId);
            renderItemsList();
        } catch (error) {
            console.error(error);
            showToast('Failed to update status.', 'error');
        }
    }
};

window.editItem = function(itemId) {
    // const items = DB.get('items');
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    // Close current details modal
    document.querySelectorAll('.modal').forEach(m => m.remove());

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <button class="modal-close"><i class="fas fa-times"></i></button>
            <h2 style="margin-bottom: 24px;">Edit Item</h2>
            <form id="edit-item-form">
                <div class="input-group"><input type="text" id="edit-item-title" class="glass-input" value="${item.title}" required><i class="fas fa-tag"></i></div>
                <div class="input-group">
                    <textarea id="edit-item-desc" class="glass-input" rows="4" required>${item.description}</textarea>
                    <i class="fas fa-align-left"></i>
                </div>
                <div class="input-group">
                    <select id="edit-item-category" class="glass-input" required>
                        <option value="Electronics" ${item.category === 'Electronics' ? 'selected' : ''}>Electronics</option>
                        <option value="Personal" ${item.category === 'Personal' ? 'selected' : ''}>Personal Items</option>
                        <option value="Documents" ${item.category === 'Documents' ? 'selected' : ''}>Documents</option>
                        <option value="Books" ${item.category === 'Books' ? 'selected' : ''}>Books</option>
                        <option value="Others" ${item.category === 'Others' ? 'selected' : ''}>Others</option>
                    </select>
                    <i class="fas fa-layer-group"></i>
                </div>
                <button type="submit" class="btn btn-primary w-100">Update Item</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    const closeModal = () => { modal.style.display = 'none'; modal.remove(); };
    modal.querySelector('.modal-close').addEventListener('click', closeModal);

    document.getElementById('edit-item-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!confirmAction('Save changes to this item?')) return;

        try {
            await apiFetch(`/api/items/${itemId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title: document.getElementById('edit-item-title').value,
                    description: document.getElementById('edit-item-desc').value,
                    category: document.getElementById('edit-item-category').value
                })
            });
            await refreshData();
            showToast('Item updated successfully!', 'success');
            closeModal();
            viewItemDetails(itemId);
            renderItemsList();
        } catch (error) {
            console.error(error);
            showToast('Failed to update item.', 'error');
        }
    });
};

window.viewItemDetails = function(itemId) {
    // const items = DB.get('items');
    const item = items.find(i => i.id === itemId);
    const user = DB.getCurrentUser();
    if (!item) return;
    const itemClaims = claims.filter(c => c.itemId === item.id);
    const canReviewClaims = item.reporterId === user.id || user.role === 'admin' || user.role === 'staff';
    const claimRequestsMarkup = canReviewClaims && itemClaims.length ? `
        <div class="claim-review-panel">
            <div class="claim-review-header">
                <div>
                    <span>Claim Requests</span>
                    <h4>${itemClaims.length} request${itemClaims.length === 1 ? '' : 's'} for this item</h4>
                </div>
                <i class="fas fa-file-signature"></i>
            </div>
            <div class="claim-request-list">
                ${itemClaims.map(claim => `
                    <div class="claim-request-card">
                        <div class="claim-request-main">
                            <strong>${claim.userName || 'Claimant'}</strong>
                            <small>${claim.userStudentId || 'No ID'} - ${claim.date || 'No date'}</small>
                            <p>${claim.description || claim.verificationAnswer || 'No claim details provided.'}</p>
                        </div>
                        <span class="status-badge claim-status ${getStatusClass(claim.status)}">${formatStatusLabel(claim.status)}</span>
                        <div class="claim-request-actions">
                            <button onclick="viewClaimDetails(${claim.id})" class="btn btn-outline btn-icon" title="View claim details"><i class="fas fa-eye"></i></button>
                            ${claim.status === 'pending' ? `
                                <button onclick="respondToClaimFromItem(${claim.id}, ${item.id}, 'approved')" class="btn btn-primary accept-claim-btn"><i class="fas fa-check"></i> Accept</button>
                                <button onclick="respondToClaimFromItem(${claim.id}, ${item.id}, 'rejected')" class="btn btn-outline decline-claim-btn"><i class="fas fa-times"></i> Decline</button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content item-detail-modal">
            <button class="modal-close"><i class="fas fa-times"></i></button>
            <div class="item-detail-layout">
                <div class="item-detail-media">
                    ${item.image ? `<img src="${item.image}" class="item-detail-image" alt="${item.title}">` : `<div class="item-detail-placeholder"><i class="fas fa-image"></i><span>No image</span></div>`}
                </div>
                <div class="item-detail-content">
                    <div class="item-detail-badges">
                        <span class="status-badge ${item.type}">${item.type}</span>
                        <span class="status-badge item-status-chip ${getStatusClass(item.status)}">${formatStatusLabel(item.status)}</span>
                    </div>
                    <h2>${item.title}</h2>
                    <p class="item-detail-description">${item.description || 'No description provided.'}</p>
                    
                    <div class="item-detail-meta">
                        <div><span>Category</span><strong>${item.category || 'Uncategorized'}</strong></div>
                        <div><span>Reported By</span><strong>${item.reporter || 'Unknown'}</strong></div>
                        <div><span>Date</span><strong>${item.date || 'No date'}</strong></div>
                    </div>

                    ${item.reporterId !== user.id && item.status === 'pending' && user.role === 'student' ? `
                        ${item.type === 'lost' ? `
                            <button onclick="notifyItemFound(${item.id})" class="btn btn-primary item-detail-full-btn"><i class="fas fa-hand-holding-heart"></i> Found This Item</button>
                        ` : `
                            <button onclick="openClaimForm(${item.id})" class="btn btn-primary item-detail-full-btn"><i class="fas fa-file-signature"></i> Claim This Item</button>
                        `}
                    ` : ''}
                    ${item.reporterId !== user.id ? `
                        <button onclick="startChat(${item.reporterId})" class="btn btn-outline item-detail-full-btn"><i class="fas fa-message"></i> Message Reporter</button>
                    ` : ''}

                    ${claimRequestsMarkup}
                    
                    ${(user.role === 'admin' || user.role === 'staff') ? `
                        <div class="item-management-panel">
                            <h4>Management Controls</h4>
                            <div class="item-management-actions">
                                <button onclick="editItem(${item.id})" class="btn btn-primary edit-item-btn"><i class="fas fa-edit"></i> Edit</button>
                                <button onclick="deleteItem(${item.id})" class="btn btn-primary delete-item-btn"><i class="fas fa-trash"></i> Delete</button>
                            </div>
                            ${renderItemStatusDropdown(item)}
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    const closeModal = () => { modal.style.display = 'none'; modal.remove(); };
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
};

window.notifyItemFound = async function(itemId) {
    // const items = DB.get('items');
    const item = items.find(i => i.id === itemId);
    const user = DB.getCurrentUser();
    // const users = DB.get('users');
    const finder = users.find(u => u.id === user.id);
    
    if (!item) return;

    if (!confirmAction(`Notify the reporter that you found "${item.title}"?`)) return;
    
    try {
        await apiFetch(`/api/items/${itemId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'found' })
        });
        addNotification(
            item.reporterId,
            'item_found',
            'Your Lost Item Found!',
            `${finder.firstName} ${finder.lastName} found your item: ${item.title}. Click to message them!`,
            item.id
        );
        await refreshData();
        showToast('Notification sent to item reporter!', 'success');
        document.querySelectorAll('.modal').forEach(m => m.remove());
    } catch (error) {
        console.error(error);
        showToast('Failed to notify item reporter.', 'error');
    }
};

window.openClaimForm = function(itemId) {
    // const items = DB.get('items');
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <button class="modal-close"><i class="fas fa-times"></i></button>
            <h2 style="margin-bottom: 20px;">Claim Item</h2>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">Please provide details to verify your ownership.</p>
            <form id="claim-form">
                <div class="input-group">
                    <textarea id="claim-desc" class="glass-input" placeholder="Describe the item in detail (color, marks, etc.)" rows="4" required></textarea>
                    <i class="fas fa-align-left"></i>
                </div>
                ${item.verificationQuestion ? `
                    <div style="margin-bottom: 24px; padding: 15px; background: rgba(106, 17, 203, 0.1); border-radius: 12px; border: 1px solid var(--accent-color);">
                        <p style="font-size: 0.85rem; margin-bottom: 10px; font-weight: 600;">Verification Question:</p>
                        <p style="margin-bottom: 15px;">${item.verificationQuestion}</p>
                        <div class="input-group" style="margin-bottom: 0;"><input type="text" id="claim-answer" class="glass-input" placeholder="Your Answer" required><i class="fas fa-key"></i></div>
                    </div>
                ` : ''}
                <button type="submit" class="btn btn-primary w-100">Submit Claim</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    const closeModal = () => { modal.style.display = 'none'; modal.remove(); };
    modal.querySelector('.modal-close').addEventListener('click', closeModal);

    document.getElementById('claim-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!confirmAction('Submit this claim request for review?')) return;

        const user = DB.getCurrentUser();
        // const claims = DB.get('claims');
        const answer = document.getElementById('claim-answer')?.value;
        
        const newClaim = {
            id: Date.now(),
            itemId: item.id,
            itemTitle: item.title,
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            userStudentId: user.role === 'student' ? user.studentId : user.staffId,
            description: document.getElementById('claim-desc').value,
            answer: answer,
            status: 'pending',
            date: new Date().toISOString().split('T')[0],
            aiMatch: answer ? (answer.toLowerCase() === item.verificationAnswer.toLowerCase()) : true
        };
        
        try {
            await apiFetch('/api/claims', {
                method: 'POST',
                body: JSON.stringify({
                    itemId: item.id,
                    verificationAnswer: `${newClaim.description}${answer ? `\nAnswer: ${answer}` : ''}`
                })
            });
            await refreshData();

            // Notify reporter locally so the current session reflects the action immediately.
            addNotification(item.reporterId, 'new_claim', 'New Claim Received', `${user.firstName} has claimed your found item: ${item.title}`, item.id);

            showToast('Claim submitted successfully!', 'success');
            closeModal();
            // Close item details modal too
            document.querySelectorAll('.modal').forEach(m => m.remove());
        } catch (error) {
            console.error(error);
            showToast('Failed to submit claim.', 'error');
        }
    });
};

function renderClaims() {
    const user = DB.getCurrentUser();
    // const claims = DB.get('claims');
    // const items = DB.get('items');
    // const ratings = DB.get('ratings');
    
    // Claims I made
    const myClaims = claims.filter(c => c.userId === user.id);
    // Claims on my items
    const myItemsIds = items.filter(i => i.reporterId === user.id).map(i => i.id);
    const claimsOnMyItems = claims.filter(c => myItemsIds.includes(c.itemId));
    
    document.getElementById('dashboard-content').innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 40px;">
            <div class="glass-card p-32">
                <h3 style="margin-bottom: 24px;">Claims on Your Items</h3>
                ${claimsOnMyItems.length === 0 ? '<p style="color: var(--text-secondary);">No claims received yet.</p>' : `
                    <table class="custom-table">
                        <thead><tr><th>Item</th><th>Claimant</th><th>Status</th><th>Action</th></tr></thead>
                        <tbody>${claimsOnMyItems.map(c => {
                            const hasRated = ratings.some(r => r.claimId === c.id && r.fromUserId === user.id);
                            return `
                            <tr>
                                <td>${c.itemTitle}</td>
                                <td>${c.userName}</td>
                                <td><span class="status-badge claim-status ${getStatusClass(c.status)}">${formatStatusLabel(c.status)}</span></td>
                                <td>
                                    <div style="display: flex; gap: 8px;">
                                        <button onclick="viewClaimDetails(${c.id})" class="btn btn-outline" style="padding: 8px 12px;"><i class="fas fa-eye"></i></button>
                                        ${c.status === 'pending' ? `
                                            <button onclick="approveClaim(${c.id})" class="btn btn-primary" style="padding: 8px 12px; background: #10b981;"><i class="fas fa-check"></i></button>
                                            <button onclick="rejectClaim(${c.id})" class="btn btn-primary" style="padding: 8px 12px; background: #ef4444;"><i class="fas fa-times"></i></button>
                                        ` : ''}
                                        ${c.status === 'approved' && !hasRated ? `
                                            <button onclick="openRatingModal(${c.id}, ${c.userId}, '${c.userName}')" class="btn btn-primary" style="padding: 8px 12px; background: #f59e0b;"><i class="fas fa-star"></i> Rate</button>
                                        ` : c.status === 'approved' ? '<span style="font-size: 0.8rem; color: #10b981;"><i class="fas fa-check-circle"></i> Rated</span>' : ''}
                                    </div>
                                </td>
                            </tr>
                        `}).join('')}</tbody>
                    </table>
                `}
            </div>
            
            <div class="glass-card p-32">
                <h3 style="margin-bottom: 24px;">Your Claims</h3>
                ${myClaims.length === 0 ? '<p style="color: var(--text-secondary);">You haven\'t made any claims yet.</p>' : `
                    <table class="custom-table">
                        <thead><tr><th>Item</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
                        <tbody>${myClaims.map(c => {
                            const item = items.find(i => i.id === c.itemId);
                            const hasRated = ratings.some(r => r.claimId === c.id && r.fromUserId === user.id);
                            return `
                            <tr>
                                <td>${c.itemTitle}</td>
                                <td>${c.date}</td>
                                <td><span class="status-badge claim-status ${getStatusClass(c.status)}">${formatStatusLabel(c.status)}</span></td>
                                <td>
                                    ${c.status === 'approved' && !hasRated ? `
                                        <button onclick="openRatingModal(${c.id}, ${item.reporterId}, '${item.reporter}')" class="btn btn-primary" style="padding: 8px 12px; background: #f59e0b;"><i class="fas fa-star"></i> Rate Founder</button>
                                    ` : c.status === 'approved' ? '<span style="font-size: 0.8rem; color: #10b981;"><i class="fas fa-check-circle"></i> Rated</span>' : '---'}
                                </td>
                            </tr>
                        `}).join('')}</tbody>
                    </table>
                `}
            </div>
        </div>
    `;
}

window.openRatingModal = function(claimId, targetUserId, targetUserName) {
    const targetUser = users.find(u => u.id === targetUserId);
    const initials = targetUser
        ? `${targetUser.firstName?.[0] || ''}${targetUser.lastName?.[0] || ''}`.toUpperCase()
        : targetUserName.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
    const targetRole = targetUser?.role || 'user';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content rating-modal-content">
            <button class="modal-close"><i class="fas fa-times"></i></button>
            <div class="rating-modal-header">
                <div class="rating-target-avatar">${initials || '<i class="fas fa-user"></i>'}</div>
                <div>
                    <span class="overview-eyebrow">Transaction feedback</span>
                    <h2>Rate ${targetUserName}</h2>
                    <p>${targetRole.charAt(0).toUpperCase() + targetRole.slice(1)} account</p>
                </div>
            </div>
            
            <form id="rating-form">
                <div class="rating-question">
                    <h3>How was your experience?</h3>
                    <p id="rating-helper-text">Choose a rating before submitting your feedback.</p>
                </div>
                <div class="star-rating" role="radiogroup" aria-label="Rating">
                    ${[1, 2, 3, 4, 5].map(value => `
                        <label class="rating-option" for="star${value}">
                            <input type="radio" id="star${value}" name="rating" value="${value}" ${value === 5 ? 'required' : ''}>
                            <i class="fas fa-star"></i>
                            <span>${value}</span>
                        </label>
                    `).join('')}
                </div>
                
                <div class="input-group rating-feedback-group">
                    <label for="rating-feedback">Feedback</label>
                    <textarea id="rating-feedback" class="glass-input" placeholder="What went well? Was the handoff clear and respectful?" rows="4" required></textarea>
                    <i class="fas fa-comment-alt"></i>
                </div>
                
                <button type="submit" class="btn btn-primary w-100 rating-submit-btn"><i class="fas fa-paper-plane"></i> Submit Rating</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    const closeModal = () => { modal.style.display = 'none'; modal.remove(); };
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    const ratingLabels = Array.from(modal.querySelectorAll('.rating-option'));
    const helperText = modal.querySelector('#rating-helper-text');
    const ratingText = {
        1: 'Needs attention. Share what should improve.',
        2: 'Some issues. Add details so the user can learn from it.',
        3: 'Okay experience. A short note is enough.',
        4: 'Good experience. Mention what worked well.',
        5: 'Excellent experience. Nice, clean handoff.'
    };

    ratingLabels.forEach(label => {
        label.addEventListener('change', () => {
            const selectedValue = Number(modal.querySelector('input[name="rating"]:checked')?.value || 0);
            ratingLabels.forEach(option => {
                const value = Number(option.querySelector('input').value);
                option.classList.toggle('selected', value <= selectedValue);
            });
            helperText.textContent = ratingText[selectedValue] || 'Choose a rating before submitting your feedback.';
        });
    });

    document.getElementById('rating-form').addEventListener('submit', (e) => {
        e.preventDefault();
        if (!confirmAction(`Submit your rating for ${targetUserName}?`)) return;

        const ratingValue = parseInt(document.querySelector('input[name="rating"]:checked').value);
        const feedback = document.getElementById('rating-feedback').value;
        const user = DB.getCurrentUser();
        
        // const ratings = DB.get('ratings');
        ratings.push({
            id: Date.now(),
            claimId: claimId,
            fromUserId: user.id,
            fromUserName: `${user.firstName} ${user.lastName}`,
            toUserId: targetUserId,
            rating: ratingValue,
            feedback: feedback,
            date: new Date().toISOString().split('T')[0]
        });
        // DB.set('ratings', ratings);
        
        // Update target user's average rating
        // const users = DB.get('users');
        const targetIdx = users.findIndex(u => u.id === targetUserId);
        if (targetIdx !== -1) {
            const userRatings = ratings.filter(r => r.toUserId === targetUserId);
            const totalRating = userRatings.reduce((sum, r) => sum + r.rating, 0);
            users[targetIdx].rating = (totalRating / userRatings.length).toFixed(1);
            users[targetIdx].ratingCount = userRatings.length;
            // DB.set('users', users);
        }
        
        addNotification(targetUserId, 'info', 'New Rating Received', `${user.firstName} has rated you ${ratingValue} stars!`);
        
        showToast('Thank you for your feedback!', 'success');
        closeModal();
        renderClaims();
    });
};

window.approveClaim = async function(claimId) {
    if (!confirmAction('Approve this claim? This will mark the item as claimed.')) return;
    // let claims = DB.get('claims');
    const claim = claims.find(c => c.id === claimId);
    if (!claim) return;
    
    try {
        await apiFetch(`/api/claims/${claimId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'approved' })
        });
        await refreshData();

        addNotification(claim.userId, 'claim_approved', 'Claim Approved!', `Your claim for "${claim.itemTitle}" has been approved by the founder!`, claim.itemId);

        showToast('Claim approved successfully!', 'success');
        renderClaims();
    } catch (error) {
        console.error(error);
        showToast('Failed to approve claim.', 'error');
    }
};

window.rejectClaim = async function(claimId) {
    if (!confirmAction('Reject this claim? This cannot be undone from this screen.')) return;
    // let claims = DB.get('claims');
    const claim = claims.find(c => c.id === claimId);
    if (!claim) return;
    
    try {
        await apiFetch(`/api/claims/${claimId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'rejected' })
        });
        await refreshData();

        addNotification(claim.userId, 'claim_rejected', 'Claim Rejected', `Your claim for "${claim.itemTitle}" was rejected.`, claim.itemId);

        showToast('Claim rejected.', 'info');
        renderClaims();
    } catch (error) {
        console.error(error);
        showToast('Failed to reject claim.', 'error');
    }
};

window.respondToClaimFromItem = async function(claimId, itemId, status) {
    const actionLabel = status === 'approved' ? 'accept' : 'decline';
    const claim = claims.find(c => c.id === claimId);
    if (!claim) return;

    if (!confirmAction(`${actionLabel === 'accept' ? 'Accept' : 'Decline'} this claim request?`)) return;

    try {
        await apiFetch(`/api/claims/${claimId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        await refreshData();

        if (status === 'approved') {
            addNotification(claim.userId, 'claim_approved', 'Claim Approved!', `Your claim for "${claim.itemTitle}" has been approved.`, claim.itemId);
            showToast('Claim accepted. Item marked as claimed.', 'success');
        } else {
            addNotification(claim.userId, 'claim_rejected', 'Claim Declined', `Your claim for "${claim.itemTitle}" was declined.`, claim.itemId);
            showToast('Claim declined.', 'info');
        }

        document.querySelectorAll('.modal').forEach(m => m.remove());
        viewItemDetails(itemId);
        if (document.getElementById('items-results')) {
            renderItemsList();
        }
    } catch (error) {
        console.error(error);
        showToast(`Failed to ${actionLabel} claim.`, 'error');
    }
};

window.viewClaimDetails = function(claimId) {
    // const claims = DB.get('claims');
    const claim = claims.find(c => c.id === claimId);
    if (!claim) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <button class="modal-close"><i class="fas fa-times"></i></button>
            <h2 style="margin-bottom: 24px;">Claim Details</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
                <div><label style="color: var(--text-secondary); font-size: 0.9rem;">Item Title</label><p style="font-weight: 600;">${claim.itemTitle}</p></div>
                <div><label style="color: var(--text-secondary); font-size: 0.9rem;">Claimant</label><p style="font-weight: 600;">${claim.userName}</p></div>
                <div><label style="color: var(--text-secondary); font-size: 0.9rem;">Student ID</label><p style="font-weight: 600;">${claim.userStudentId}</p></div>
                <div><label style="color: var(--text-secondary); font-size: 0.9rem;">Claim Status</label><p style="margin-top: 6px;"><span class="status-badge claim-status ${getStatusClass(claim.status)}">${formatStatusLabel(claim.status)}</span></p></div>
                <div><label style="color: var(--text-secondary); font-size: 0.9rem;">AI Match</label><p style="font-weight: 600; color: ${claim.aiMatch ? '#10b981' : '#ef4444'}">${claim.aiMatch ? 'SUCCESS' : 'FAILED'}</p></div>
            </div>
            <div style="margin-bottom: 24px;"><label style="color: var(--text-secondary); font-size: 0.9rem;">Claim Description</label><p style="font-weight: 600; margin-top: 8px;">${claim.description}</p></div>
            ${claim.answer ? `<div style="margin-bottom: 24px;"><label style="color: var(--text-secondary); font-size: 0.9rem;">Verification Answer Provided</label><p style="font-weight: 600; margin-top: 8px;">${claim.answer}</p></div>` : ''}
            <div style="display: flex; gap: 12px;">
                <button onclick="startChat(${claim.userId})" class="btn btn-primary" style="flex: 1;">Message Claimant</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    const closeModal = () => { modal.style.display = 'none'; modal.remove(); };
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
};

function renderUserSearch() {
    // const users = DB.get('users');
    const currentUser = DB.getCurrentUser();
    const searchableUsers = users
        .filter(u => u.id !== currentUser.id)
        .filter(u => u.firstName && u.lastName);
    
    document.getElementById('dashboard-content').innerHTML = `
        <div class="search-bar-container">
            <div style="position: relative; flex: 1; max-width: 400px;">
                <i class="fas fa-search search-icon"></i>
                <input type="text" id="user-search-input" class="search-input" placeholder="Search users by name or ID..." style="padding-left: 44px;">
            </div>
        </div>
        <div class="user-search-grid" id="user-results-grid">
            ${searchableUsers.map(u => {
                const fullName = `${u.firstName} ${u.lastName}`;
                const initials = `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
                const institutionId = u.role === 'student' ? u.studentId : u.staffId;

                return `
                <div class="glass-card user-search-card">
                    ${u.profilePicture ? 
                        `<img src="${u.profilePicture}" class="user-search-avatar" alt="${fullName}">` : 
                        `<div class="user-avatar user-search-avatar">${initials}</div>`
                    }
                    <div class="user-search-info">
                        <h4>${fullName}</h4>
                        <p>${(u.role || 'user').toUpperCase()}${institutionId ? ` | ${institutionId}` : ''}</p>
                    </div>
                    <div class="user-search-actions">
                        <button onclick="viewPublicProfile(${u.id})" class="btn btn-outline btn-icon" aria-label="View ${fullName} profile"><i class="fas fa-user"></i></button>
                        <button onclick="startChat(${u.id})" class="btn btn-primary btn-icon" aria-label="Message ${fullName}"><i class="fas fa-comment"></i></button>
                    </div>
                </div>
            `}).join('')}
        </div>
    `;

    const searchInput = document.getElementById('user-search-input');
    searchInput.addEventListener('keyup', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.user-search-card').forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(term) ? 'grid' : 'none';
        });
    });
}

window.viewPublicProfile = function(userId) {
    // const users = DB.get('users');
    const user = users.find(u => u.id === userId);
    // const ratings = DB.get('ratings').filter(r => r.toUserId === userId);
    if (!user) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; text-align: center;">
            <button class="modal-close"><i class="fas fa-times"></i></button>
            ${user.profilePicture ? 
                `<img src="${user.profilePicture}" style="width: 120px; height: 120px; border-radius: 30px; object-fit: cover; margin-bottom: 20px; border: 2px solid var(--accent-color);">` : 
                `<div class="user-avatar" style="width: 120px; height: 120px; font-size: 3rem; margin: 0 auto 20px;">${user.firstName[0]}${user.lastName[0]}</div>`
            }
            <h2 style="margin-bottom: 8px;">${user.firstName} ${user.lastName}</h2>
            <span style="background: rgba(106, 17, 203, 0.2); padding: 4px 12px; border-radius: 8px; font-size: 0.9rem; color: var(--accent-color); font-weight: bold; text-transform: uppercase;">${user.role}</span>
            
            <div style="margin-top: 30px; text-align: left; background: rgba(255,255,255,0.03); padding: 20px; border-radius: 20px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div style="margin-bottom: 15px;"><label style="color: var(--text-secondary); font-size: 0.8rem;">Institution ID</label><p style="font-weight: 600;">${user.role === 'student' ? user.studentId : user.staffId}</p></div>
                    <div style="margin-bottom: 15px;"><label style="color: var(--text-secondary); font-size: 0.8rem;">Rating</label><p style="font-weight: 600; color: #f59e0b;">⭐ ${user.rating || '5.0'} (${user.ratingCount || 0} reviews)</p></div>
                </div>
                ${user.department ? `<div style="margin-bottom: 15px;"><label style="color: var(--text-secondary); font-size: 0.8rem;">Department</label><p style="font-weight: 600;">${user.department}</p></div>` : ''}
                ${user.email ? `<div style="margin-bottom: 15px;"><label style="color: var(--text-secondary); font-size: 0.8rem;">Email</label><p style="font-weight: 600;">${user.email}</p></div>` : ''}
            </div>

            <div style="margin-top: 25px; text-align: left;">
                <h3 style="margin-bottom: 15px; font-size: 1.1rem;">Recent Feedback</h3>
                <div style="max-height: 200px; overflow-y: auto; padding-right: 10px;">
                    ${ratings.length === 0 ? '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No feedback yet.</p>' : ratings.map(r => `
                        <div class="feedback-card">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span style="font-weight: 600; font-size: 0.9rem;">${r.fromUserName}</span>
                                <div class="rating-display"><i class="fas fa-star"></i> ${r.rating}</div>
                            </div>
                            <p style="font-size: 0.85rem; color: var(--text-secondary);">${r.feedback}</p>
                            <small style="display: block; margin-top: 8px; opacity: 0.5; font-size: 0.7rem;">${r.date}</small>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <button onclick="startChat(${user.id})" class="btn btn-primary w-100" style="margin-top: 25px; padding: 16px;">Send Message</button>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    const closeModal = () => { modal.style.display = 'none'; modal.remove(); };
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
};

function renderProfile() {
    const user = DB.getCurrentUser();
    // const users = DB.get('users');
    const dbUser = users.find(u => u.id === user.id);
    
    document.getElementById('dashboard-content').innerHTML = `
        <div class="glass-card p-40" style="max-width: 800px; margin: 0 auto;">
            <div style="display: flex; align-items: center; gap: 32px; margin-bottom: 40px;">
                <div style="position: relative;">
                    ${dbUser.profilePicture ? 
                        `<img src="${dbUser.profilePicture}" style="width: 120px; height: 120px; border-radius: 24px; object-fit: cover; border: 2px solid var(--accent-color);">` : 
                        `<div class="user-avatar" style="width: 120px; height: 120px; font-size: 3rem;">${dbUser.firstName[0]}${dbUser.lastName[0]}</div>`
                    }
                    <button onclick="document.getElementById('profile-pic-input').click()" style="position: absolute; bottom: -10px; right: -10px; width: 40px; height: 40px; border-radius: 50%; background: var(--primary-gradient); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                        <i class="fas fa-camera"></i>
                    </button>
                    <input type="file" id="profile-pic-input" hidden accept="image/*">
                </div>
                <div>
                    <h2 style="font-size: 2rem; margin-bottom: 8px;">${dbUser.firstName} ${dbUser.middleInitial ? dbUser.middleInitial + '. ' : ''}${dbUser.lastName}</h2>
                    <span style="background: var(--primary-gradient); padding: 6px 16px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; text-transform: capitalize;">${dbUser.role}</span>
                </div>
            </div>
            
            <form id="profile-edit-form">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 30px;">
                    <div class="input-group"><label style="display: block; margin-bottom: 8px; color: var(--text-secondary);">First Name</label><input type="text" id="prof-fname" class="glass-input" value="${dbUser.firstName}" required><i class="fas fa-user"></i></div>
                    <div class="input-group"><label style="display: block; margin-bottom: 8px; color: var(--text-secondary);">Middle Initial</label><input type="text" id="prof-middle" class="glass-input" value="${dbUser.middleInitial || ''}" maxlength="5"><i class="fas fa-user-edit"></i></div>
                    <div class="input-group"><label style="display: block; margin-bottom: 8px; color: var(--text-secondary);">Last Name</label><input type="text" id="prof-lname" class="glass-input" value="${dbUser.lastName}" required><i class="fas fa-user"></i></div>
                    <div class="input-group"><label style="display: block; margin-bottom: 8px; color: var(--text-secondary);">Email Address</label><input type="email" id="prof-email" class="glass-input" value="${dbUser.email || ''}"><i class="fas fa-envelope"></i></div>
                    <div class="input-group"><label style="display: block; margin-bottom: 8px; color: var(--text-secondary);">${dbUser.role === 'student' ? 'Student ID' : 'Staff ID'}</label><input type="text" class="glass-input" value="${dbUser.role === 'student' ? dbUser.studentId : dbUser.staffId}" readonly style="opacity: 0.7;"><i class="fas fa-id-card"></i></div>
                </div>
                ${dbUser.role === 'student' ? `
                    <div class="input-group" style="margin-bottom: 30px;">
                        <label style="display: block; margin-bottom: 8px; color: var(--text-secondary);">Department</label>
                        <input type="text" id="prof-dept" class="glass-input" value="${dbUser.department || ''}">
                        <i class="fas fa-university"></i>
                    </div>
                ` : ''}
                <button type="submit" class="btn btn-primary w-100">Save Changes</button>
            </form>

            <form id="change-password-form" style="margin-top: 36px; padding-top: 30px; border-top: 1px solid var(--glass-border);">
                <h3 style="margin-bottom: 20px;">Change Password</h3>
                <div class="input-group"><label style="display: block; margin-bottom: 8px; color: var(--text-secondary);">Current Password</label><input type="password" id="current-password" class="glass-input" required><i class="fas fa-lock"></i></div>
                <div class="input-group"><label style="display: block; margin-bottom: 8px; color: var(--text-secondary);">New Password</label><input type="password" id="new-password" class="glass-input" required><i class="fas fa-key"></i></div>
                <div class="input-group"><label style="display: block; margin-bottom: 8px; color: var(--text-secondary);">Confirm New Password</label><input type="password" id="confirm-new-password" class="glass-input" required><i class="fas fa-key"></i></div>
                <button type="submit" class="btn btn-outline w-100">Change Password</button>
            </form>
        </div>
    `;

    document.getElementById('profile-pic-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (re) => {
                if (!confirmAction('Update your profile picture?')) return;

                try {
                    const updatedUser = await apiFetch('/api/users/me', {
                        method: 'PUT',
                        body: JSON.stringify({
                            firstName: dbUser.firstName,
                            middleInitial: dbUser.middleInitial,
                            lastName: dbUser.lastName,
                            email: dbUser.email,
                            department: dbUser.department,
                            profilePicture: re.target.result
                        })
                    });
                    setCurrentUser(updatedUser);
                    await refreshData();
                    updateUserHeader();
                    showToast('Profile picture updated!', 'success');
                    renderProfile();
                } catch (error) {
                    console.error(error);
                    showToast('Failed to update profile picture.', 'error');
                }
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('profile-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!confirmAction('Save these profile changes?')) return;

        try {
            const updatedUser = await apiFetch('/api/users/me', {
                method: 'PUT',
                body: JSON.stringify({
                    firstName: document.getElementById('prof-fname').value,
                    middleInitial: document.getElementById('prof-middle').value,
                    lastName: document.getElementById('prof-lname').value,
                    email: document.getElementById('prof-email').value,
                    department: dbUser.role === 'student' ? document.getElementById('prof-dept').value : dbUser.department
                })
            });
            setCurrentUser(updatedUser);
            await refreshData();
            updateUserHeader();
            showToast('Profile updated successfully!', 'success');
            renderProfile();
        } catch (error) {
            console.error(error);
            showToast('Failed to update profile.', 'error');
        }
    });

    document.getElementById('change-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-new-password').value;

        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match.', 'error');
            return;
        }

        if (!confirmAction('Change your account password?')) return;

        try {
            await apiFetch('/api/users/me/password', {
                method: 'PUT',
                body: JSON.stringify({ currentPassword, newPassword })
            });

            document.getElementById('change-password-form').reset();
            showToast('Password changed successfully!', 'success');
        } catch (error) {
            console.error(error);
            showToast(error.message || 'Failed to change password.', 'error');
        }
    });
}

// --- Staff & Admin Panels ---
function renderStaffPanel() {
    renderUserManagementPanel('staff');
}

function renderAdminPanel() {
    renderUserManagementPanel('admin');
}

function renderUserManagementPanel(role) {
    // const users = DB.get('users');
    const currentUser = DB.getCurrentUser();
    
    document.getElementById('dashboard-content').innerHTML = `
        <div class="user-management-stack">
            <div class="glass-card p-32">
                <h3 style="margin-bottom: 24px;">Register New ${role === 'admin' ? 'User' : 'Student'}</h3>
                <form id="register-user-form">
                    <div class="management-form-grid">
                        <div class="input-group"><input type="text" id="reg-fname" class="glass-input" placeholder="First Name" required><i class="fas fa-user"></i></div>
                        <div class="input-group"><input type="text" id="reg-middle" class="glass-input" placeholder="Middle Initial" maxlength="5"><i class="fas fa-user-edit"></i></div>
                        <div class="input-group"><input type="text" id="reg-lname" class="glass-input" placeholder="Last Name" required><i class="fas fa-user"></i></div>
                        <div class="input-group"><input type="email" id="reg-email" class="glass-input" placeholder="Email" required><i class="fas fa-envelope"></i></div>
                        <div class="input-group password-field">
                            <input type="password" id="reg-password" class="glass-input" placeholder="Password" required>
                            <i class="fas fa-lock"></i>
                            <button type="button" class="password-toggle" onclick="togglePasswordVisibility('reg-password', this)" aria-label="Show password" title="Show password">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                        <div class="input-group select-field">
                            <select id="reg-dept" class="glass-input enhanced-select" required>
                                ${renderDepartmentOptions()}
                            </select>
                            <i class="fas fa-university select-icon"></i>
                            <i class="fas fa-chevron-down select-arrow"></i>
                        </div>
                        <div class="input-group">
                            <input type="text" id="reg-id" class="glass-input" placeholder="${role === 'admin' ? 'Student/Staff ID' : 'Student ID'}" required>
                            <i class="fas fa-id-card"></i>
                        </div>
                        ${role === 'admin' ? `
                            <div class="input-group select-field">
                                <select id="reg-role" class="glass-input enhanced-select" required>
                                    <option value="student">Student</option>
                                    <option value="staff">Staff</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <i class="fas fa-user-tag select-icon"></i>
                                <i class="fas fa-chevron-down select-arrow"></i>
                            </div>
                        ` : ''}
                    </div>
                    <div class="management-form-actions">
                        <button type="submit" class="btn btn-primary"><i class="fas fa-user-plus"></i> Register User</button>
                        <button type="reset" class="btn btn-outline"><i class="fas fa-rotate-left"></i> Clear Form</button>
                    </div>
                </form>
            </div>

            <div class="glass-card p-32">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h3>Manage Users</h3>
                    <div style="position: relative; width: 300px;">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" id="manage-users-search" class="search-input" placeholder="Search users..." style="padding-left: 44px;">
                    </div>
                </div>
                <table class="custom-table">
                    <thead><tr><th>Name</th><th>Middle</th><th>ID</th><th>Role</th><th>Department</th><th>Action</th></tr></thead>
                    <tbody id="manage-users-list">
                        ${users.filter(u => role === 'admin' ? u.id !== currentUser.id : u.role === 'student').map(u => `
                            <tr class="user-row">
                                <td>${u.firstName} ${u.lastName}</td>
                                <td>${u.middleInitial || 'N/A'}</td>
                                <td>${u.role === 'student' ? u.studentId : u.staffId}</td>
                                <td style="text-transform: capitalize;">${u.role}</td>
                                <td>${u.department || 'N/A'}</td>
                                <td>
                                    <div style="display: flex; gap: 8px;">
                                        <button onclick="viewPublicProfile(${u.id})" class="btn btn-outline" style="padding: 8px 12px;"><i class="fas fa-eye"></i></button>
                                        <button onclick="editUser(${u.id})" class="btn btn-primary" style="padding: 8px 12px;"><i class="fas fa-edit"></i></button>
                                        <button onclick="deleteUser(${u.id}, '${role}')" class="btn btn-primary" style="padding: 8px 12px; background: var(--danger);"><i class="fas fa-trash"></i></button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const roleSelect = document.getElementById('reg-role');
    const idInput = document.getElementById('reg-id');
    const syncRoleFields = () => {
        const selectedRole = roleSelect?.value || 'student';
        if (idInput) {
            idInput.placeholder = selectedRole === 'student' ? 'Student ID' : 'Staff ID';
        }
    };

    if (roleSelect) {
        roleSelect.addEventListener('change', syncRoleFields);
        syncRoleFields();
    }

    document.getElementById('register-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const userRole = role === 'admin' ? document.getElementById('reg-role').value : 'student';

        if (!confirmAction(`Create this ${userRole} account?`)) return;

        try {
            await createUser({
                firstName: document.getElementById('reg-fname').value,
                middleInitial: document.getElementById('reg-middle').value,
                lastName: document.getElementById('reg-lname').value,
                email: document.getElementById('reg-email').value,
                password: document.getElementById('reg-password').value,
                department: document.getElementById('reg-dept').value,
                role: userRole,
                institutionId: document.getElementById('reg-id').value
            });

            showToast('User registered successfully!', 'success');
            renderUserManagementPanel(role);

        } catch (error) {
            console.error(error);
            showToast('Failed to register user.', 'error');
        }
    });

    document.getElementById('manage-users-search').addEventListener('keyup', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.user-row').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(term) ? 'table-row' : 'none';
        });
    });
}

window.deleteUser = async function(userId, panelRole) {
    if (!confirmAction('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
        await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
        await refreshData();
        showToast('User deleted successfully.', 'info');
        renderUserManagementPanel(panelRole);
    } catch (error) {
        console.error(error);
        showToast('Failed to delete user.', 'error');
    }
};

window.editUser = function(userId) {
    // const users = DB.get('users');
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <button class="modal-close"><i class="fas fa-times"></i></button>
            <h2 style="margin-bottom: 24px;">Edit User</h2>
            <form id="edit-user-form">
                <div class="input-group"><input type="text" id="edit-fname" class="glass-input" value="${user.firstName}" required><i class="fas fa-user"></i></div>
                <div class="input-group"><input type="text" id="edit-middle" class="glass-input" value="${user.middleInitial || ''}" placeholder="Middle Initial" maxlength="5"><i class="fas fa-user-edit"></i></div>
                <div class="input-group"><input type="text" id="edit-lname" class="glass-input" value="${user.lastName}" required><i class="fas fa-user"></i></div>
                <div class="input-group"><input type="email" id="edit-email" class="glass-input" value="${user.email}" required><i class="fas fa-envelope"></i></div>
                <div class="input-group"><input type="text" id="edit-dept" class="glass-input" value="${user.department || ''}"><i class="fas fa-university"></i></div>
                <button type="submit" class="btn btn-primary w-100">Update User</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    const closeModal = () => { modal.style.display = 'none'; modal.remove(); };
    modal.querySelector('.modal-close').addEventListener('click', closeModal);

    document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!confirmAction('Save changes to this user account?')) return;

        try {
            await apiFetch(`/api/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    firstName: document.getElementById('edit-fname').value,
                    middleInitial: document.getElementById('edit-middle').value,
                    lastName: document.getElementById('edit-lname').value,
                    email: document.getElementById('edit-email').value,
                    department: document.getElementById('edit-dept').value
                })
            });
            await refreshData();
            showToast('User updated successfully!', 'success');
            closeModal();
            const currentUser = DB.getCurrentUser();
            renderUserManagementPanel(currentUser.role);
        } catch (error) {
            console.error(error);
            showToast('Failed to update user.', 'error');
        }
    });
};

// --- Messaging, Notifications, Toast, etc. ---
let pendingImage = null;

// Update message badge count
function updateMessageBadge() {
    const user = DB.getCurrentUser();
    if (!user) return;
    
    // const messages = DB.get('messages') || [];
    const unreadCount = messages.filter(m => m.to === user.id && !m.read).length;
    const messageBadge = document.getElementById('message-badge');
    
    if (messageBadge) {
        if (unreadCount > 0) {
            messageBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            messageBadge.classList.remove('hidden');
        } else {
            messageBadge.classList.add('hidden');
        }
    }
}

window.startChat = async function(userId) { 
    document.querySelectorAll('.modal').forEach(m => m.remove());
    await showDashboardTab('messages'); 
    renderMessages(userId); 
};

window.renderMessages = function(activeContactId = null) {
    const user = DB.getCurrentUser();
    // const users = DB.get('users');
    // const messages = DB.get('messages');
    const contacts = users.filter(u => u.id !== user.id);
    
    document.getElementById('dashboard-content').innerHTML = `
        <div class="chat-layout">
            <div class="chat-sidebar glass-card p-20">
                <div style="margin-bottom: 16px; position: relative;">
                    <i class="fas fa-search search-icon" style="font-size: 0.8rem;"></i>
                    <input type="text" id="contact-search" class="search-input" placeholder="Search users..." style="padding: 10px 10px 10px 35px; font-size: 0.85rem; border-radius: 12px;">
                </div>
                <h3 style="margin-bottom: 16px; font-size: 1rem;">Contacts</h3>
                <div id="contacts-list" style="flex: 1; overflow-y: auto;">
                    ${contacts.map(c => {
                        const unreadFromContact = messages.filter(m => m.from === c.id && m.to === user.id && !m.read).length;
                        return `
                        <div class="chat-user-card glass-card ${activeContactId == c.id ? 'active' : ''}" onclick="renderMessages(${c.id})" style="position: relative;">
                            <div style="flex: 1; overflow: hidden;">
                                <div style="font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.firstName} ${c.lastName}</div>
                                <small style="color: var(--text-secondary); text-transform: capitalize;">${c.role}</small>
                            </div>
                            ${unreadFromContact > 0 ? `<span style="background: var(--accent-color); color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">${unreadFromContact > 9 ? '9+' : unreadFromContact}</span>` : ''}
                        </div>
                    `}).join('')}
                </div>
            </div>
            <div class="chat-main glass-card">
                ${activeContactId ? `
                    <div class="chat-header" style="padding: 15px 20px; border-bottom: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 12px; cursor: pointer;" onclick="viewPublicProfile(${activeContactId})">
                            ${users.find(u => u.id === activeContactId).profilePicture ? 
                                `<img src="${users.find(u => u.id === activeContactId).profilePicture}" style="width: 32px; height: 32px; border-radius: 8px; object-fit: cover;">` : 
                                `<div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.7rem;">${users.find(u => u.id === activeContactId).firstName[0]}${users.find(u => u.id === activeContactId).lastName[0]}</div>`
                            }
                            <span style="font-weight: 600;">${users.find(u => u.id === activeContactId).firstName} ${users.find(u => u.id === activeContactId).lastName}</span>
                        </div>
                        <button onclick="viewPublicProfile(${activeContactId})" class="btn btn-outline" style="padding: 8px; width: 36px; height: 36px; border-radius: 10px;"><i class="fas fa-user"></i></button>
                    </div>
                    <div class="chat-messages" id="chat-messages">${messages.filter(m => (m.from === user.id && m.to === activeContactId) || (m.from === activeContactId && m.to === user.id)).map(m => `
                        <div class="message ${m.from === user.id ? 'sent' : 'received'}">
                            ${m.text ? `<span>${m.text}</span>` : ''}
                            ${m.image ? `<img src="${m.image}" class="message-image" onclick="enlargeImage('${m.image}')">` : ''}
                        </div>
                    `).join('')}</div>
                    <div id="image-preview-area" class="hidden"></div>
                    <form class="chat-input-area" id="chat-form">
                        <button type="button" onclick="document.getElementById('chat-image-input').click()" class="btn btn-outline btn-icon"><i class="fas fa-image"></i></button>
                        <input type="file" id="chat-image-input" hidden accept="image/*">
                        <input type="text" id="msg-input" class="glass-input" placeholder="Type a message..." style="flex: 1;">
                        <button type="submit" class="btn btn-primary btn-icon"><i class="fas fa-paper-plane"></i></button>
                    </form>` : `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; opacity: 0.5;"><i class="fas fa-comments" style="font-size: 4rem;"></i><p>Select a contact</p></div>`}
            </div>
        </div>
    `;
    
    const contactSearch = document.getElementById('contact-search');
    if (contactSearch) {
        contactSearch.addEventListener('keyup', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.chat-user-card').forEach(card => {
                const name = card.querySelector('div > div').textContent.toLowerCase();
                card.style.display = name.includes(term) ? 'flex' : 'none';
            });
        });
    }

    if (activeContactId) {
        const chatForm = document.getElementById('chat-form');
        const chatMessages = document.getElementById('chat-messages');
        const imageInput = document.getElementById('chat-image-input');
        
        // Mark messages as read when viewing conversation
        messages.forEach(m => {
            if (m.to === user.id && m.from === activeContactId) {
                m.read = true;
            }
        });
        updateMessageBadge();
        apiFetch(`/api/messages/read/${activeContactId}`, { method: 'PUT' })
            .then(refreshData)
            .catch(error => console.error('Failed to mark messages read:', error));
        
        // Scroll to bottom
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
        
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    pendingImage = re.target.result;
                    const previewArea = document.getElementById('image-preview-area');
                    previewArea.innerHTML = `
                        <div class="image-preview-container">
                            <div class="image-preview-wrapper">
                                <img src="${pendingImage}" class="image-preview">
                                <button type="button" onclick="clearImagePreview()" class="remove-image-preview"><i class="fas fa-times"></i></button>
                            </div>
                            <span style="font-size: 0.8rem; color: var(--text-secondary);">Image ready to send</span>
                        </div>
                    `;
                    previewArea.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        });

        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = document.getElementById('msg-input').value;
            if (!text && !pendingImage) return;
            const users = DB.get('users');
            const sender = users.find(u => u.id === user.id);

            const messageText = text.trim() || '[Image message]';

            try {
                await apiFetch('/api/messages', {
                    method: 'POST',
                    body: JSON.stringify({
                        receiverId: activeContactId,
                        text: messageText
                    })
                });

                // Add notification to receiver
                addNotification(
                    activeContactId, 
                    'new_message', 
                    'New Message', 
                    `${sender.firstName} ${sender.lastName} sent you a message${messageText ? ': ' + messageText.substring(0, 50) : ''}${messageText && messageText.length > 50 ? '...' : ''}`,
                    null
                );

                pendingImage = null;
                document.getElementById('msg-input').value = '';
                await refreshData();
                renderMessages(activeContactId);
                showToast('Message sent!', 'success');
            } catch (error) {
                console.error(error);
                showToast('Failed to send message.', 'error');
            }
        });
    }
};

window.clearImagePreview = function() {
    pendingImage = null;
    const previewArea = document.getElementById('image-preview-area');
    previewArea.innerHTML = '';
    previewArea.classList.add('hidden');
    document.getElementById('chat-image-input').value = '';
};

window.enlargeImage = function(src) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="background: transparent; border: none; box-shadow: none; text-align: center;">
            <button class="modal-close"><i class="fas fa-times"></i></button>
            <img src="${src}" class="modal-image-enlarge">
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    const closeModal = () => { modal.style.display = 'none'; modal.remove(); };
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
};

function renderNotificationsPage() {
    const user = DB.getCurrentUser();
    let notifications = DB.get('notifications') || [];
    const userNotifications = notifications.filter(n => n.userId === user.id).sort((a,b) => b.timestamp - a.timestamp);
    
    document.getElementById('dashboard-content').innerHTML = `
        <div class="glass-card p-40">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <h3>Notifications</h3>
                <button onclick="clearNotifications()" class="btn btn-outline" style="font-size: 0.8rem;">Clear All</button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${userNotifications.length === 0 ? '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No notifications yet.</p>' : ''}
                ${userNotifications.map(n => `
                    <div class="glass-card p-20 notification-card" 
                         style="border-left: 4px solid ${n.read ? 'transparent' : 'var(--accent-color)'}; opacity: ${n.read ? '0.7' : '1'}; cursor: ${n.itemId ? 'pointer' : 'default'};"
                         ${n.itemId ? `onclick="handleNotificationClick(${n.itemId})"` : ''}>
                        <h4 style="margin-bottom: 5px;">${n.title}</h4>
                        <p style="color: var(--text-secondary); font-size: 0.9rem;">${n.message}</p>
                        <small style="display: block; margin-top: 10px; opacity: 0.5;">${new Date(n.timestamp).toLocaleString()}</small>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    notifications.forEach(n => { if (n.userId === user.id) n.read = true; });
    DB.set('notifications', notifications);
    if (getToken()) {
        apiFetch('/api/notifications/read', { method: 'PUT' }).catch(error => console.error('Failed to mark notifications read:', error));
    }
    updateNotificationBadge();
}

window.handleNotificationClick = function(itemId) {
    if (!itemId) return;
    // For this system, we show the item details modal.
    // We might need to ensure we are on a tab where items can be seen, 
    // but viewItemDetails works from anywhere as it appends a modal to body.
    viewItemDetails(itemId);
};

window.clearNotifications = async function() {
    const user = DB.getCurrentUser();
    if (!confirmAction('Clear all your notifications?')) return;

    try {
        if (getToken()) {
            await apiFetch('/api/notifications', { method: 'DELETE' });
        }
        let notifications = DB.get('notifications') || [];
        notifications = notifications.filter(n => n.userId !== user.id);
        DB.set('notifications', notifications);
        updateNotificationBadge();
        renderNotificationsPage();
    } catch (error) {
        console.error(error);
        showToast('Failed to clear notifications.', 'error');
    }
};

window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast glass-card ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${icons[type]}" style="color: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : 'white'}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; setTimeout(() => toast.remove(), 400); }, 3000);
};

window.logout = logout;


async function showDashboard() {
    // Hide landing page
    document.getElementById('landing-section').classList.add('hidden');

    // Hide login section
    document.getElementById('login-section').classList.add('hidden');

    // Hide navbar
    document.getElementById('navbar').classList.add('hidden');

    // Show dashboard section
    document.getElementById('dashboard-section').classList.remove('hidden');

    try {
        await refreshData();
        updateUserHeader();
        updateNotificationBadge();
        updateMessageBadge();
    } catch (error) {
        console.error(error);
        showToast('Failed to load dashboard data.', 'error');
    }

    // Load default dashboard tab
    if (typeof showDashboardTab === 'function') {
        showDashboardTab('overview');
    }
}

function seedData() {
    console.log('seedData executed');
}

// Event Listeners
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {

        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok && data.token) {

            setToken(data.token);
            setCurrentUser(data.user);

            showToast('Login successful!', 'success');

            await showDashboard();

        } else {

            showToast(data.error || 'Invalid email or password', 'error');

        }

    } catch (error) {

        console.error(error);

        showToast('Login failed.', 'error');

    }
});

document.getElementById('forgot-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('forgot-email').value;
    const institutionId = document.getElementById('forgot-id').value;
    const newPassword = document.getElementById('forgot-new-password').value;
    const confirmPassword = document.getElementById('forgot-confirm-password').value;

    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match.', 'error');
        return;
    }

    if (!confirmAction('Reset this account password?')) return;

    try {
        await fetch(`${API_URL}/api/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, institutionId, newPassword })
        }).then(async response => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'Password reset failed');
            return data;
        });

        document.getElementById('forgot-password-form').reset();
        showToast('Password reset successfully. Please log in.', 'success');
        toggleAuth('login');
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Password reset failed.', 'error');
    }
});

seedData();
cleanOldItems();
showSection('landing');


async function loadReports() {
    const container = document.getElementById("reportsContainer");
    if (!container || !getToken()) return;

    const res = await fetch(`${API_URL}/reports`, {
        headers: {
            Authorization: `Bearer ${getToken()}`
        }
    });
    const reports = await res.json();

    container.innerHTML = "";

    reports.forEach(r => {
        container.innerHTML += `
            <div class="card">
                <h3>${r.item_name}</h3>
                <p>${r.description}</p>
                <p>Status: ${r.status}</p>
                <p>Date: ${r.date_reported}</p>
                <button onclick="deleteReport('${r.report_id}')">Delete</button>
            </div>
        `;
    });
}

window.onload = loadReports;

async function renderTransactions() {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i><p>Loading transactions...</p></div>';
    
    try {
        const transactions = await apiFetch('/api/transactions');
        
        if (transactions.length === 0) {
            content.innerHTML = `
                <div class="glass-card p-40 text-center">
                    <i class="fas fa-history" style="font-size: 4rem; opacity: 0.1; margin-bottom: 20px;"></i>
                    <h3>No Transactions Yet</h3>
                    <p style="color: var(--text-secondary);">Your activity history will appear here.</p>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="glass-card p-32">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <h3>Activity Log</h3>
                </div>
                <table class="custom-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>User</th>
                            <th>Type</th>
                            <th>Item</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions.map(t => {
                            const typeClass = getTransactionTypeClass(t.type);
                            return `
                            <tr>
                                <td>${new Date(t.timestamp).toLocaleString()}</td>
                                <td>${t.firstName} ${t.lastName}</td>
                                <td><span class="status-badge transaction-type ${typeClass}">${formatTransactionType(t.type)}</span></td>
                                <td>${t.itemTitle || 'N/A'}</td>
                                <td>${t.description}</td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        content.innerHTML = `<div class="glass-card p-40 text-center"><p style="color: var(--danger);">Error loading transactions: ${error.message}</p></div>`;
    }
}

function formatTransactionType(type = '') {
    return String(type)
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function getTransactionTypeClass(type = '') {
    return String(type)
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_-]/g, '');
}

function formatStatusLabel(status = '') {
    return String(status)
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function getStatusClass(status = '') {
    return String(status)
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_-]/g, '');
}

                    
