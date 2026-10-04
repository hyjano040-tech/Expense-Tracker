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
    // Attempt parse
    const parsed = new Date(item.timestamp);
    if (!isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  return getCurrentMonthKey();
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
            type: 'PERMANENT',
            timestamp: timestamp,
            monthKey: currentMonthKey,
            recurringRuleId: doc.id,
            isAutoMonthly: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          autoAddedCount++;
        }

        await doc.ref.update({
          lastAppliedMonth: currentMonthKey,
          lastAppliedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    if (autoAddedCount > 0) {
      showToast(`⚡ ${autoAddedCount} fixed monthly expense(s) auto-recorded for ${monthName}!`, 'info');
    }
  } catch (err) {
    console.error("Error checking recurring expenses:", err);
  }
}

function listenToRecurringRules(userId) {
  db.collection('users').doc(userId).collection('recurring_rules')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      activeRecurringRules = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        data.id = doc.id;
        activeRecurringRules.push(data);
      });

      const countBadge = document.getElementById('recurringCount');
      if (countBadge) {
        countBadge.innerText = activeRecurringRules.length;
      }

      renderRecurringList();
    });
}

function toggleRecurringModal() {
  const modal = document.getElementById('recurringModal');
  if (!modal) return;
  const isVisible = modal.style.display === 'flex';
  modal.style.display = isVisible ? 'none' : 'flex';
  if (!isVisible) {
    renderRecurringList();
  }
}

function renderRecurringList() {
  const list = document.getElementById('recurringList');
  if (!list) return;

  if (activeRecurringRules.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; padding: 30px 10px; color: var(--text-muted);">
        <i class="fa-solid fa-calendar-xmark" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
        <p>No monthly fixed rules active yet.</p>
        <span style="font-size: 0.8rem;">Select <strong>"Permanent / Fixed Expense"</strong> in the form to set an auto-repeating outflow.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = activeRecurringRules.map(rule => `
    <div class="recurring-item">
      <div class="recurring-item-info">
        <strong>${escapeHtml(rule.title)}</strong>
        <span><i class="fa-solid fa-arrows-rotate"></i> Auto-deducts monthly • Last applied: ${rule.lastAppliedMonth || 'Active'}</span>
      </div>
      <div class="recurring-actions">
        <span class="recurring-item-amount">- Rs. ${(rule.amount || 0).toLocaleString()}</span>
        <button class="btn-delete-rule" onclick="deleteRecurringRule('${rule.id}')" title="Stop Auto-Monthly Deduction">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function deleteRecurringRule(ruleId) {
  if (confirm("Are you sure you want to stop this monthly fixed deduction? Future months will not auto-deduct this amount.")) {
    db.collection('users').doc(currentUser.uid).collection('recurring_rules').doc(ruleId).delete()
      .then(() => {
        showToast("Fixed monthly rule removed.", "info");
      })
      .catch(err => {
        showToast("Error: " + err.message, "error");
      });
  }
}

// ==========================================================================
// Transaction Operations: Add, Load, Filter, Delete
// ==========================================================================
async function addTransaction() {
  const title = document.getElementById('title').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const type = document.getElementById('type').value;
  const dateInput = document.getElementById('transactionDate')?.value;

  if (!title || isNaN(amount) || amount <= 0) {
    showToast("Please enter a valid title and positive amount!", "error");
    return;
  }

  const addBtn = document.getElementById('addTransactionBtn');
  if (addBtn) addBtn.disabled = true;

  // Determine date and monthKey
  let txDate = new Date();
  if (dateInput) {
    const [y, m, d] = dateInput.split('-').map(Number);
    txDate = new Date(y, m - 1, d);
  }

  const dateStr = txDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const timestamp = `${dateStr}, ${timeStr}`;
  const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;

  try {
    let recurringRuleId = null;

    if (type === 'PERMANENT') {
      const ruleRef = await db.collection('users').doc(currentUser.uid).collection('recurring_rules').add({
        title: title,
        amount: amount,
        lastAppliedMonth: monthKey,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      recurringRuleId = ruleRef.id;
    }

    await db.collection('users').doc(currentUser.uid).collection('transactions').add({
      title: title,
      amount: amount,
      type: type,
      timestamp: timestamp,
      monthKey: monthKey,
      recurringRuleId: recurringRuleId,
      isAutoMonthly: type === 'PERMANENT',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    document.getElementById('title').value = '';
    document.getElementById('amount').value = '';
    
    const notice = document.getElementById('permanentNotice');
    if (notice) notice.style.display = 'none';

    // If active month filter is different from transaction month, notify or sync
    if (activeMonthKey !== 'ALL' && activeMonthKey !== monthKey) {
      activeMonthKey = monthKey;
      const picker = document.getElementById('monthPicker');
      if (picker) picker.value = monthKey;
      updateQuickPillState();
    }

    if (type === 'PERMANENT') {
      showToast("Fixed expense saved & set to auto-repeat every month!", "success");
    } else {
      showToast("Transaction recorded successfully!", "success");
    }
  } catch (err) {
    showToast("Data Save Error: " + err.message, "error");
  } finally {
    if (addBtn) addBtn.disabled = false;
  }
}

// Real-time Firestore Listener
function loadUserTransactions() {
  db.collection('users').doc(currentUser.uid).collection('transactions')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      currentTransactions = [];

      snapshot.forEach(doc => {
        const item = doc.data();
        item.id = doc.id;
        item.computedMonthKey = getTransactionMonthKey(item);
        currentTransactions.push(item);
      });

      // Update both summary statistics and table rows
      updateDashboardView();
    }, error => {
      showToast("Error loading records: " + error.message, "error");
    });
}

// Master view update: recalculates metrics & filters rows according to active month
function updateDashboardView() {
  // 1. Filter transactions by selected Month
  const monthFiltered = currentTransactions.filter(item => {
    if (activeMonthKey === 'ALL') return true;
    return (item.computedMonthKey || item.monthKey) === activeMonthKey;
  });

  // 2. Compute Summary Totals for the active month
  let totalIncome = 0;
  let totalExpense = 0;

  monthFiltered.forEach(item => {
    if (item.type === 'IN') {
      totalIncome += (item.amount || 0);
    } else {
      totalExpense += (item.amount || 0);
    }
  });

  const net = totalIncome - totalExpense;

  // 3. Update Stat Card UI
  document.getElementById('totalIncome').innerText = 'Rs. ' + totalIncome.toLocaleString();
  document.getElementById('totalExpense').innerText = 'Rs. ' + totalExpense.toLocaleString();
  document.getElementById('netBalance').innerText = 'Rs. ' + net.toLocaleString();

  const balanceHint = document.getElementById('balanceStatusHint');
  if (balanceHint) {
    const monthTag = activeMonthKey === 'ALL' ? 'Overall' : formatMonthLabel(activeMonthKey);
    if (net >= 0) {
      balanceHint.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${monthTag}: Healthy`;
    } else {
      balanceHint.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${monthTag}: Deficit`;
    }
  }

  // 4. Render Table with further text search and type filter
  renderTransactionsTable(monthFiltered);
}

function filterTransactions() {
  updateDashboardView();
}

function renderTransactionsTable(sourceTransactions) {
  const listToRender = sourceTransactions || currentTransactions.filter(item => {
    if (activeMonthKey === 'ALL') return true;
    return (item.computedMonthKey || item.monthKey) === activeMonthKey;
  });

  const table = document.getElementById('historyTable');
  const emptyState = document.getElementById('emptyState');
  const tableWrapper = document.getElementById('transactionsMainTable');
  const searchQuery = (document.getElementById('searchFilter')?.value || '').toLowerCase().trim();
  const typeFilter = document.getElementById('typeFilter')?.value || 'ALL';

  table.innerHTML = '';

  const filtered = listToRender.filter(item => {
    const matchesSearch = !searchQuery || (item.title && item.title.toLowerCase().includes(searchQuery));
    const matchesType = typeFilter === 'ALL' || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (filtered.length === 0) {
    if (emptyState) {
      emptyState.style.display = 'block';
      const emptyP = emptyState.querySelector('p');
      if (emptyP) {
        if (activeMonthKey === 'ALL') {
          emptyP.innerText = "No transactions found across all time.";
        } else {
          emptyP.innerText = `No transactions recorded for ${formatMonthLabel(activeMonthKey)}.`;
        }
      }
    }
    if (tableWrapper) tableWrapper.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (tableWrapper) tableWrapper.style.display = 'table';

  filtered.forEach(item => {
    let typeTag = '';
    let amountClass = 'td-amount-out';
    let amountPrefix = '- ';

    if (item.type === 'IN') {
      typeTag = '<span class="tag-income"><i class="fa-solid fa-arrow-down-left"></i> IN</span>';
      amountClass = 'td-amount-in';
      amountPrefix = '+ ';
    } else if (item.type === 'OUT') {
      typeTag = '<span class="tag-expense"><i class="fa-solid fa-arrow-up-right"></i> OUT</span>';
    } else {
      typeTag = '<span class="tag-expense"><i class="fa-solid fa-arrow-up-right"></i> OUT</span> <span class="tag-perm"><i class="fa-solid fa-lock"></i> Fixed</span>';
      if (item.isAutoMonthly) {
        typeTag += ' <span class="badge-auto" title="Auto-deducted every month"><i class="fa-solid fa-arrows-rotate"></i> Monthly Auto</span>';
      }
    }

    const row = table.insertRow();
    row.innerHTML = `
      <td>${item.timestamp || 'Just now'}</td>
      <td><strong>${escapeHtml(item.title)}</strong></td>
      <td>${typeTag}</td>
      <td class="td-amount ${amountClass}">${amountPrefix}Rs. ${(item.amount || 0).toLocaleString()}</td>
      <td style="text-align: center;">
        <button class="btn-delete" onclick="deleteTransaction('${item.id}')" title="Delete record">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </td>
    `;
  });
}

function deleteTransaction(docId) {
  if (confirm("Are you sure you want to delete this transaction record?")) {
    db.collection('users').doc(currentUser.uid).collection('transactions').doc(docId).delete()
      .then(() => {
        showToast("Transaction deleted", "info");
      })
      .catch(err => {
        showToast("Error deleting: " + err.message, "error");
      });
  }
}

// Utility: Prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}