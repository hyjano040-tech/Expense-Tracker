// ==========================================================================
// Firebase Configuration & Initialization
// ==========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDuhAqfVJ_as3q5LV1IjibRMRCMRweNhRM",
  authDomain: "income-tracker-4c2a5.firebaseapp.com",
  projectId: "income-tracker-4c2a5",
  storageBucket: "income-tracker-4c2a5.firebasestorage.app",
  messagingSenderId: "805849206198",
  appId: "1:805849206198:web:9138ef3c65a5feb1978517",
  measurementId: "G-X8CYHZPPZY"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentTransactions = []; // Cached transactions for client-side search & filtering
let activeRecurringRules = []; // Cached recurring rules
let activeMonthKey = getCurrentMonthKey(); // e.g. "2026-10" or "ALL"

// ==========================================================================
// Theme Management (Dark / Light)
// ==========================================================================
function initTheme() {
  const savedTheme = localStorage.getItem('smartflow_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('smartflow_theme', newTheme);
  updateThemeIcon(newTheme);
  showToast(`Switched to ${newTheme} mode`, 'info');
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

// Run theme setup immediately
initTheme();

// ==========================================================================
// Modern Toast Notification System
// ==========================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconClass = 'fa-circle-info';
  if (type === 'success') iconClass = 'fa-circle-check';
  if (type === 'error') iconClass = 'fa-circle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================================================
// Auth Mode Switcher (Login vs Sign Up Tabs)
// ==========================================================================
function switchAuthTab(mode) {
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const authTitle = document.getElementById('authTitle');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const authSwitchPrompt = document.getElementById('authSwitchPrompt');

  if (mode === 'login') {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    authTitle.innerText = 'Welcome Back';
    loginBtn.style.display = 'inline-flex';
    signupBtn.style.display = 'none';
    authSwitchPrompt.innerHTML = `Don't have an account? <a href="javascript:void(0)" onclick="switchAuthTab('signup')">Sign up</a>`;
  } else {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    authTitle.innerText = 'Create an Account';
    loginBtn.style.display = 'none';
    signupBtn.style.display = 'inline-flex';
    authSwitchPrompt.innerHTML = `Already have an account? <a href="javascript:void(0)" onclick="switchAuthTab('login')">Log in</a>`;
  }
}

function togglePasswordVisibility(fieldId, btn) {
  const input = document.getElementById(fieldId);
  const icon = btn.querySelector('i');
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-regular fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fa-regular fa-eye';
  }
}

// ==========================================================================
// Category Type Selector Notice
// ==========================================================================
function handleTypeChange() {
  const type = document.getElementById('type').value;
  const notice = document.getElementById('permanentNotice');
  if (notice) {
    notice.style.display = type === 'PERMANENT' ? 'flex' : 'none';
  }
}

// ==========================================================================
// MONTH SELECTION & FILTER ENGINE
// ==========================================================================

// Helper: Current Month string "YYYY-MM"
function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Initialize pickers default values
function initMonthPickers() {
  const monthPicker = document.getElementById('monthPicker');
  if (monthPicker && !monthPicker.value) {
    monthPicker.value = getCurrentMonthKey();
  }

  const txDate = document.getElementById('transactionDate');
  if (txDate && !txDate.value) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    txDate.value = `${yyyy}-${mm}-${dd}`;
  }
}

// Reset Transaction Date to Today
function setTodayDate() {
  const txDate = document.getElementById('transactionDate');
  if (txDate) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    txDate.value = `${yyyy}-${mm}-${dd}`;
    showToast("Date set to Today", "info");
  }
}

// Open native date picker popup when clicking anywhere in wrapper
function openDatePicker(id) {
  const el = document.getElementById(id);
  if (el && typeof el.showPicker === 'function') {
    try {
      el.showPicker();
    } catch (e) {
      el.focus();
    }
  }
}

// Triggered when user selects a month from the date input
function onMonthPickerChange() {
  const picker = document.getElementById('monthPicker');
  if (!picker || !picker.value) return;

  activeMonthKey = picker.value;
  updateQuickPillState();
  updateDashboardView();
  showToast(`Showing records for ${formatMonthLabel(activeMonthKey)}`, 'info');
}

// Previous / Next Month Navigation Buttons
function changeMonth(delta) {
  let baseKey = activeMonthKey === 'ALL' ? getCurrentMonthKey() : activeMonthKey;
  const [yearStr, monthStr] = baseKey.split('-');
  const d = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1 + delta, 1);

  activeMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  
  const picker = document.getElementById('monthPicker');
  if (picker) {
    picker.value = activeMonthKey;
  }

  updateQuickPillState();
  updateDashboardView();
  showToast(`Switched to ${formatMonthLabel(activeMonthKey)}`, 'info');
}

// Quick filter buttons: 'current' (This Month) or 'all' (All Time)
function selectQuickMonth(mode) {
  if (mode === 'current') {
    activeMonthKey = getCurrentMonthKey();
    const picker = document.getElementById('monthPicker');
    if (picker) picker.value = activeMonthKey;
    showToast(`Viewing current month (${formatMonthLabel(activeMonthKey)})`, 'info');
  } else {
    activeMonthKey = 'ALL';
    showToast(`Viewing All-Time transactions`, 'info');
  }

  updateQuickPillState();
  updateDashboardView();
}

function updateQuickPillState() {
  const btnThis = document.getElementById('btnThisMonth');
  const btnAll = document.getElementById('btnAllMonths');

  if (btnThis) {
    btnThis.classList.toggle('active', activeMonthKey === getCurrentMonthKey());
  }
  if (btnAll) {
    btnAll.classList.toggle('active', activeMonthKey === 'ALL');
  }
}

// Helper to format "2026-10" to "Oct 2026"
function formatMonthLabel(monthKey) {
  if (monthKey === 'ALL') return 'All Time';
  if (!monthKey || !monthKey.includes('-')) return monthKey || '';
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

// Helper: Extract YYYY-MM from transaction item
function getTransactionMonthKey(item) {
  if (item.monthKey) return item.monthKey;

  if (item.createdAt && typeof item.createdAt.toDate === 'function') {
    const d = item.createdAt.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  if (item.timestamp) {
    const parsed = new Date(item.timestamp);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  return getCurrentMonthKey();
}

// ==========================================================================
// Robust Date & Time Parser for Exact Sorting (Handles legacy string dates)
// ==========================================================================
function getNumericTimestamp(item) {
  // 1. Numeric timestamp
  if (item.sortTimestamp && typeof item.sortTimestamp === 'number') {
    return item.sortTimestamp;
  }

  // 2. Firestore Timestamp
  if (item.createdAt && typeof item.createdAt.toMillis === 'function') {
    return item.createdAt.toMillis();
  }

  // 3. String Timestamp Parsing (e.g., "06 Oct 2026, 23:22")
  if (item.timestamp) {
    try {
      let cleanStr = item.timestamp.replace(',', '');
      let parsedDate = new Date(cleanStr);

      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.getTime();
      }
    } catch (e) {
      console.error("Date parse error:", e);
    }
  }

  // 4. Fallback for date/time properties
  if (item.date) {
    let dateTimeStr = item.time ? `${item.date}T${item.time}` : `${item.date}T00:00:00`;
    let parsedDate = new Date(dateTimeStr);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.getTime();
    }
  }

  return 0;
}

// ==========================================================================
// Auth State Observer
// ==========================================================================
auth.onAuthStateChanged(user => {
  const authSection = document.getElementById('authSection');
  const appSection = document.getElementById('appSection');

  if (user) {
    currentUser = user;
    authSection.style.display = 'none';
    appSection.style.display = 'block';

    const emailDisplay = user.email || 'User';
    document.getElementById('userEmailTag').innerText = emailDisplay;
    
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
      avatar.innerText = emailDisplay.charAt(0).toUpperCase();
    }

    initMonthPickers();

    // Check and automatically deduct monthly fixed expenses for new month
    checkAndApplyRecurringExpenses(user.uid);

    // Load user transactions and recurring rules
    loadUserTransactions();
    listenToRecurringRules(user.uid);
  } else {
    currentUser = null;
    currentTransactions = [];
    activeRecurringRules = [];
    authSection.style.display = 'block';
    appSection.style.display = 'none';
  }
});

// ==========================================================================
// Auth Handlers (Signup, Login, Logout)
// ==========================================================================
function handleSignup() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;

  if (!email || password.length < 6) {
    showToast("Please enter a valid email & password with at least 6 characters.", "error");
    return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then(() => {
      showToast("Account created successfully! Welcome!", "success");
    })
    .catch(error => {
      showToast("Signup Error: " + error.message, "error");
    });
}

function handleLogin() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;

  if (!email || !password) {
    showToast("Please enter both email and password.", "error");
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      showToast("Logged in successfully!", "success");
    })
    .catch(error => {
      showToast("Login Error: " + error.message, "error");
    });
}

function handleLogout() {
  auth.signOut()
    .then(() => {
      showToast("You have been signed out.", "info");
    });
}

// ==========================================================================
// AUTOMATIC MONTHLY FIXED EXPENSE LOGIC
// ==========================================================================

async function checkAndApplyRecurringExpenses(userId) {
  if (!userId) return;
  const currentMonthKey = getCurrentMonthKey();
  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'short', year: 'numeric' });

  try {
    const rulesSnap = await db.collection('users').doc(userId).collection('recurring_rules').get();
    let autoAddedCount = 0;

    for (const doc of rulesSnap.docs) {
      const rule = doc.data();
      
      if (rule.lastAppliedMonth !== currentMonthKey) {
        const existingTx = await db.collection('users').doc(userId).collection('transactions')
          .where('recurringRuleId', '==', doc.id)
          .where('monthKey', '==', currentMonthKey)
          .get();

        if (existingTx.empty) {
          const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const timestamp = `${dateStr}, ${timeStr}`;

          await db.collection('users').doc(userId).collection('transactions').add({
            title: rule.title,
            amount: rule.amount,
