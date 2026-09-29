/* =========================================================
   BORROWBOX — MODERN FRONTEND LOGIC & CIRCULATION SYSTEM
   Full Enterprise Functionality with Real-time API Integration
   ========================================================= */

/* ===== 1. API CONFIGURATION & STATE ===== */
const API_CONFIG = {
    LOCAL: 'http://localhost:8080/api/books',
    PRODUCTION: 'https://labtaskbackend.onrender.com/api/books'
};

// Storage keys
const STORAGE_KEYS = {
    THEME: 'borrowbox_theme',
    VIEW: 'borrowbox_view',
    API_ENV: 'borrowbox_api_env'
};

// Determine default API endpoint
const savedEnv = localStorage.getItem(STORAGE_KEYS.API_ENV);
let currentApiEnv = savedEnv || 'production';
let activeApiUrl = currentApiEnv === 'local' ? API_CONFIG.LOCAL : API_CONFIG.PRODUCTION;

// Credentials for administrative mutations (POST, PUT, DELETE)
const AUTH_HEADER = 'Basic ' + btoa('admin:admin123');

const getAuthHeaders = (json = true) => {
    const headers = { 'Authorization': AUTH_HEADER };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
};

// DOM helper
const $ = (id) => document.getElementById(id);

// Application state
let state = {
    books: [],
    filteredBooks: [],
    editingId: null,
    deleteTargetId: null,
    view: localStorage.getItem(STORAGE_KEYS.VIEW) || 'grid',
    filters: {
        search: '',
        category: '',
        availability: '',
        sort: 'default'
    }
};

/* ===== 2. THEME SYSTEM ===== */
function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEYS.THEME, next);
    showToast(`Switched to ${next} theme`, 'info');
}

/* ===== 3. TOAST NOTIFICATION SYSTEM ===== */
let toastTimeout = null;

function showToast(message, type = 'success') {
    const toast = $('toast');
    const toastMsg = $('toastMsg');
    const toastIcon = $('toastIcon');
    if (!toast || !toastMsg) return;

    clearTimeout(toastTimeout);

    // SVG icons by type
    const icons = {
        success: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        error: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        info: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };

    toastIcon.innerHTML = icons[type] || icons.info;
    toastMsg.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');

    toastTimeout = setTimeout(() => {
        hideToast();
    }, 3200);
}

function hideToast() {
    const toast = $('toast');
    if (toast) toast.classList.add('hidden');
}

/* ===== 4. API STATUS & SWITCHER ===== */
function updateApiBadge(isOnline, latency = null) {
    const dot = $('apiStatus');
    const text = $('apiStatusText');
    const latencyEl = $('apiLatency');

    if (dot) {
        dot.classList.toggle('online', isOnline);
        dot.classList.toggle('offline', !isOnline);
    }

    if (text) {
        const envLabel = currentApiEnv === 'local' ? 'Local' : 'Cloud';
        text.textContent = isOnline ? `${envLabel} Online` : `${envLabel} Offline`;
    }

    if (latencyEl) {
        latencyEl.textContent = latency !== null ? `${latency}ms` : (isOnline ? 'Active' : 'Unreachable');
    }
}

async function testApiLatency(url) {
    const start = performance.now();
    try {
        const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(6000) });
        const latency = Math.round(performance.now() - start);
        return { ok: res.ok, latency };
    } catch {
        return { ok: false, latency: null };
    }
}

async function apiCall(url, options = {}) {
    try {
        const start = performance.now();
        const res = await fetch(url, options);
        const latency = Math.round(performance.now() - start);
        const json = await res.json();
        updateApiBadge(true, latency);
        return { ok: res.ok, json };
    } catch (err) {
        updateApiBadge(false);
        throw new Error('Could not connect to backend server');
    }
}

function initApiSwitcher() {
    const statusBtn = $('apiStatusBtn');
    const popover = $('apiPopover');
    const reconnectBtn = $('reconnectApiBtn');
    const radioProd = $('apiRadioProd');
    const radioLocal = $('apiRadioLocal');

    if (radioProd && radioLocal) {
        radioProd.checked = currentApiEnv === 'production';
        radioLocal.checked = currentApiEnv === 'local';

        radioProd.addEventListener('change', () => switchApi('production'));
        radioLocal.addEventListener('change', () => switchApi('local'));
    }

    if (statusBtn && popover) {
        statusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            popover.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!popover.contains(e.target) && e.target !== statusBtn) {
                popover.classList.add('hidden');
            }
        });
    }

    if (reconnectBtn) {
        reconnectBtn.addEventListener('click', async () => {
            showToast('Testing connection...', 'info');
            const { ok, latency } = await testApiLatency(activeApiUrl);
            updateApiBadge(ok, latency);
            if (ok) {
                showToast(`Connected (${latency}ms)`, 'success');
                await loadBooks();
            } else {
                showToast('Connection failed. Server might be spinning up.', 'error');
            }
        });
    }
}

async function switchApi(env) {
    currentApiEnv = env;
    localStorage.setItem(STORAGE_KEYS.API_ENV, env);
    activeApiUrl = env === 'local' ? API_CONFIG.LOCAL : API_CONFIG.PRODUCTION;
    $('apiPopover').classList.add('hidden');
    showToast(`Switched backend to ${env === 'local' ? 'Local' : 'Cloud'} API`, 'info');
    await loadBooks();
}

/* ===== 5. LOAD BOOKS FROM SERVER ===== */
async function loadBooks() {
    setLoading(true);
    try {
        const { ok, json } = await apiCall(activeApiUrl);
        if (!ok || !json.success) throw new Error(json.message || 'Failed to fetch catalog');

        state.books = json.data || [];
        applyFilters();
        updateStats();
        populateCategoryOptions();
    } catch (err) {
        console.warn('API fetch warning:', err);
        // If local failed and we haven't tried production, auto-fallback
        if (currentApiEnv === 'local') {
            showToast('Local backend unavailable. Falling back to Cloud...', 'info');
            switchApi('production');
            return;
        }
        showToast(err.message || 'Could not load books from server', 'error');
        state.books = [];
        state.filteredBooks = [];
        renderBooks();
        updateStats();
    } finally {
        setLoading(false);
    }
}

function setLoading(isLoading) {
    const skeleton = $('loadingState');
    const bookList = $('bookList');
    const bookTable = $('bookTableContainer');
    const emptyState = $('emptyState');

    if (skeleton) skeleton.classList.toggle('hidden', !isLoading);
    if (isLoading) {
        if (bookList) bookList.classList.add('hidden');
        if (bookTable) bookTable.classList.add('hidden');
        if (emptyState) emptyState.classList.add('hidden');
    }
}

/* ===== 6. STATS & KPI METRICS ===== */
function updateStats() {
    const books = state.books;
    const totalTitles = books.length;
    
    let totalCopiesSum = 0;
    let availableCopiesSum = 0;
    let outOfStockTitles = 0;
    const categoriesSet = new Set();

    books.forEach(b => {
        const total = Number(b.totalCopies) || 0;
        const available = Number(b.availableCopies) || 0;
        totalCopiesSum += total;
        availableCopiesSum += available;
        if (available <= 0) outOfStockTitles++;
        if (b.category) categoriesSet.add(b.category.trim());
    });

    // KPI Values
    animateNumber($('statTotal'), totalTitles);
    animateNumber($('statAvailable'), availableCopiesSum);
    animateNumber($('statOut'), outOfStockTitles);
    animateNumber($('statCategories'), categoriesSet.size);

    // Micro Stats
    if ($('statTotalCopiesSum')) {
        $('statTotalCopiesSum').textContent = `${totalCopiesSum} total copies in library`;
    }

    if ($('statOutSubtitle')) {
        $('statOutSubtitle').textContent = `${outOfStockTitles} title${outOfStockTitles === 1 ? '' : 's'} with 0 copies left`;
    }

    // Availability Rate Meter
    const rate = totalCopiesSum > 0 ? Math.round((availableCopiesSum / totalCopiesSum) * 100) : 0;
    const meter = $('statAvailableMeter');
    const rateText = $('statAvailableRate');
    if (meter) meter.style.width = `${rate}%`;
    if (rateText) rateText.textContent = `${rate}% of copies ready for loan`;
}

function animateNumber(element, target) {
    if (!element) return;
    const current = parseInt(element.textContent) || 0;
    if (current === target) {
        element.textContent = target;
        return;
    }

    const duration = 400;
    const start = performance.now();

    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const value = Math.round(current + (target - current) * progress);
        element.textContent = value;
        if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

/* ===== 7. FILTERING, SEARCH & SORTING ===== */
function applyFilters() {
    const { search, category, availability, sort } = state.filters;
    const query = search.toLowerCase().trim();

    // Filter
    let result = state.books.filter(book => {
        const matchSearch = !query ||
            (book.title || '').toLowerCase().includes(query) ||
            (book.author || '').toLowerCase().includes(query) ||
            (book.isbn || '').toLowerCase().includes(query);

        const matchCategory = !category || book.category === category;

        const matchAvailability = !availability ||
            (availability === 'available' && book.availableCopies > 0) ||
            (availability === 'out' && book.availableCopies <= 0);

        return matchSearch && matchCategory && matchAvailability;
    });

    // Sort
    switch (sort) {
        case 'title-asc':
            result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            break;
        case 'title-desc':
            result.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
            break;
        case 'author-asc':
            result.sort((a, b) => (a.author || '').localeCompare(b.author || ''));
            break;
        case 'copies-desc':
            result.sort((a, b) => (b.totalCopies || 0) - (a.totalCopies || 0));
            break;
        case 'available-desc':
            result.sort((a, b) => (b.availableCopies || 0) - (a.availableCopies || 0));
            break;
        default:
            break;
    }

    state.filteredBooks = result;
    renderBooks();
    renderActiveFilterChips();
}

function populateCategoryOptions() {
    const select = $('categoryFilter');
    if (!select) return;

    const currentVal = select.value;
    const categories = [...new Set(state.books.map(b => b.category).filter(Boolean))].sort();

    select.innerHTML = '<option value="">All Categories</option>' +
        categories.map(cat => {
            const count = state.books.filter(b => b.category === cat).length;
            return `<option value="${escapeHtml(cat)}">${escapeHtml(cat)} (${count})</option>`;
        }).join('');

    select.value = currentVal;
}

function renderActiveFilterChips() {
    const container = $('activeFilterChips');
    const resetBtn = $('resetFiltersBtn');
    if (!container) return;

    const { search, category, availability, sort } = state.filters;
    const chips = [];

    if (search) chips.push({ label: `"${search}"`, clear: () => { $('searchInput').value = ''; state.filters.search = ''; } });
    if (category) chips.push({ label: `Category: ${category}`, clear: () => { $('categoryFilter').value = ''; state.filters.category = ''; } });
    if (availability) chips.push({ label: availability === 'available' ? 'In Stock' : 'Out of Stock', clear: () => { $('availabilityFilter').value = ''; state.filters.availability = ''; } });
    if (sort !== 'default') chips.push({ label: `Sorted`, clear: () => { $('sortBySelect').value = 'default'; state.filters.sort = 'default'; } });

    if (resetBtn) resetBtn.classList.toggle('hidden', chips.length === 0);

    container.innerHTML = chips.map((c, idx) => `
        <span class="filter-chip">
            ${escapeHtml(c.label)}
            <span class="chip-remove-btn" onclick="clearSpecificFilter(${idx})">&times;</span>
        </span>
    `).join('');

    window._activeFilterHandlers = chips.map(c => c.clear);
}

function clearSpecificFilter(index) {
    if (window._activeFilterHandlers && window._activeFilterHandlers[index]) {
        window._activeFilterHandlers[index]();
        applyFilters();
    }
}

function clearAllFilters() {
    $('searchInput').value = '';
    $('categoryFilter').value = '';
    $('availabilityFilter').value = '';
    $('sortBySelect').value = 'default';
    state.filters = { search: '', category: '', availability: '', sort: 'default' };
    $('clearSearchBtn')?.classList.add('hidden');
    applyFilters();
}

/* ===== 8. RENDER BOOKS (GRID & TABLE) ===== */
function renderBooks() {
    const books = state.filteredBooks;
    const gridContainer = $('bookList');
    const tableContainer = $('bookTableContainer');
    const tableBody = $('bookTableBody');
    const emptyState = $('emptyState');
    const countBadge = $('bookCount');

    if (countBadge) countBadge.textContent = books.length;

    if (books.length === 0) {
        if (gridContainer) gridContainer.classList.add('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    if (state.view === 'table') {
        if (gridContainer) gridContainer.classList.add('hidden');
        if (tableContainer) tableContainer.classList.remove('hidden');
        renderTableView(books, tableBody);
    } else {
        if (tableContainer) tableContainer.classList.add('hidden');
        if (gridContainer) {
            gridContainer.classList.remove('hidden');
            renderGridView(books, gridContainer);
        }
    }
}

// Category helper for spine colors
function getCategoryColorClass(cat) {
    const c = (cat || '').toLowerCase();
    if (c.includes('program')) return 'spine-programming';
    if (c.includes('soft') || c.includes('engineer')) return 'spine-software';
    if (c.includes('fict') || c.includes('novel')) return 'spine-fiction';
    if (c.includes('scien')) return 'spine-science';
    if (c.includes('hist')) return 'spine-history';
    if (c.includes('busin') || c.includes('econ')) return 'spine-business';
    return 'spine-default';
}

function renderGridView(books, container) {
    container.innerHTML = books.map(book => {
        const available = Number(book.availableCopies) || 0;
        const total = Number(book.totalCopies) || 1;
        const percent = Math.min(Math.round((available / total) * 100), 100);
        const isAvailable = available > 0;
        const fillClass = percent > 50 ? 'fill-high' : percent > 0 ? 'fill-mid' : 'fill-empty';
        const spineClass = getCategoryColorClass(book.category);

        return `
        <article class="book-card" data-id="${book.id}">
            <div class="book-card-spine ${spineClass}"></div>
            <div class="book-card-body">
                <div class="card-meta-top">
                    <span class="category-chip">${escapeHtml(book.category || 'General')}</span>
                    <span class="badge-stock ${isAvailable ? 'available' : 'out'}">
                        <span class="badge-dot"></span>
                        ${isAvailable ? `${available} In Stock` : 'Out of Stock'}
                    </span>
                </div>

                <h3 class="book-title" onclick="openDetailsModal('${book.id}')" title="View details: ${escapeHtml(book.title)}">
                    ${escapeHtml(book.title)}
                </h3>

                <div class="book-author-row">
                    <svg class="author-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>${escapeHtml(book.author || 'Unknown')}</span>
                </div>

                <div class="book-stock-meter-wrap">
                    <div class="stock-meter-labels">
                        <span>Circulation Capacity</span>
                        <span>${available} / ${total} copies</span>
                    </div>
                    <div class="stock-meter-bar">
                        <div class="stock-meter-bar-fill ${fillClass}" style="width: ${percent}%"></div>
                    </div>
                    <span class="card-isbn-tag">ISBN: ${escapeHtml(book.isbn || 'N/A')}</span>
                </div>
            </div>

            <div class="book-card-actions">
                <div class="actions-primary-group">
                    <button type="button" class="btn-action btn-borrow" onclick="borrowBook('${book.id}')" ${!isAvailable ? 'disabled title="Cannot borrow: 0 copies remaining"' : 'title="Issue book loan"'}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        <span>Borrow</span>
                    </button>
                    <button type="button" class="btn-action btn-return" onclick="returnBook('${book.id}')" title="Return loaned copy">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        <span>Return</span>
                    </button>
                </div>
                <div class="actions-secondary-group">
                    <button type="button" class="btn-icon-subtle" onclick="openDetailsModal('${book.id}')" title="Quick view">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button type="button" class="btn-icon-subtle" onclick="editBook('${book.id}')" title="Edit book catalog entry">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                    <button type="button" class="btn-icon-subtle btn-icon-delete" onclick="openDeleteModal('${book.id}')" title="Delete book">
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        </article>
        `;
    }).join('');
}

function renderTableView(books, tbody) {
    if (!tbody) return;
    tbody.innerHTML = books.map(book => {
        const available = Number(book.availableCopies) || 0;
        const total = Number(book.totalCopies) || 1;
        const percent = Math.min(Math.round((available / total) * 100), 100);
        const isAvailable = available > 0;
        const fillClass = percent > 50 ? 'fill-high' : percent > 0 ? 'fill-mid' : 'fill-empty';

        return `
        <tr>
            <td>
                <div class="table-book-info">
                    <h4 onclick="openDetailsModal('${book.id}')">${escapeHtml(book.title)}</h4>
                    <span>${escapeHtml(book.author)}</span>
                </div>
            </td>
            <td><span class="category-chip">${escapeHtml(book.category || 'General')}</span></td>
            <td><span class="table-isbn-code">${escapeHtml(book.isbn)}</span></td>
            <td style="min-width: 150px;">
                <div class="stock-meter-labels">
                    <span>${available}/${total}</span>
                    <span>${percent}%</span>
                </div>
                <div class="stock-meter-bar" style="height: 4px; margin-top: 3px;">
                    <div class="stock-meter-bar-fill ${fillClass}" style="width: ${percent}%"></div>
                </div>
            </td>
            <td>
                <span class="badge-stock ${isAvailable ? 'available' : 'out'}">
                    <span class="badge-dot"></span>
                    ${isAvailable ? 'In Stock' : 'Out'}
                </span>
            </td>
            <td class="text-right">
                <div class="actions-primary-group" style="justify-content: flex-end;">
                    <button type="button" class="btn-action btn-borrow" onclick="borrowBook('${book.id}')" ${!isAvailable ? 'disabled' : ''}>Borrow</button>
                    <button type="button" class="btn-action btn-return" onclick="returnBook('${book.id}')">Return</button>
                    <button type="button" class="btn-icon-subtle" onclick="editBook('${book.id}')" title="Edit">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                    <button type="button" class="btn-icon-subtle btn-icon-delete" onclick="openDeleteModal('${book.id}')" title="Delete">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

/* ===== 9. CIRCULATION ACTIONS (BORROW / RETURN) ===== */
async function borrowBook(id) {
    try {
        const { ok, json } = await apiCall(`${activeApiUrl}/${id}/borrow`, {
            method: 'POST',
            headers: getAuthHeaders(false)
        });

        if (!ok || !json.success) throw new Error(json.message || 'Could not borrow book');

        showToast('Book borrowed successfully!', 'success');
        await loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function returnBook(id) {
    try {
        const { ok, json } = await apiCall(`${activeApiUrl}/${id}/return`, {
            method: 'POST',
            headers: getAuthHeaders(false)
        });

        if (!ok || !json.success) throw new Error(json.message || 'Could not return book');

        showToast('Book returned successfully!', 'success');
        await loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* ===== 10. ADD & EDIT DRAWER MODAL ===== */
function openAddModal() {
    state.editingId = null;
    resetForm();
    $('formTitle').textContent = 'Add New Book';
    $('submitBtnText').textContent = 'Add Book';
    $('bookModalBackdrop').classList.remove('hidden');
    $('title').focus();
    updateFormLivePreview();
}

function editBook(target) {
    const book = typeof target === 'string' ? state.books.find(b => b.id === target) : target;
    if (!book) return;

    state.editingId = book.id;
    $('bookId').value = book.id;
    $('title').value = book.title || '';
    $('author').value = book.author || '';
    $('isbn').value = book.isbn || '';
    $('category').value = book.category || '';
    $('totalCopies').value = book.totalCopies || 1;
    $('availableCopies').value = book.availableCopies || 0;

    $('formTitle').textContent = 'Edit Book';
    $('submitBtnText').textContent = 'Update Book';
    $('bookModalBackdrop').classList.remove('hidden');
    $('title').focus();
    updateFormLivePreview();
}

function closeBookModal() {
    $('bookModalBackdrop').classList.add('hidden');
}

function handleDrawerBackdropClick(e) {
    if (e.target.id === 'bookModalBackdrop') {
        closeBookModal();
    }
}

function resetForm() {
    $('bookForm').reset();
    $('bookId').value = '';
    state.editingId = null;
    $('totalCopies').value = '5';
    $('availableCopies').value = '5';
    updateFormLivePreview();
}

function setQuickCategory(name) {
    $('category').value = name;
    updateFormLivePreview();
}

function updateFormLivePreview() {
    const title = $('title').value.trim() || 'Book Title Appears Here';
    const author = $('author').value.trim() || 'Author Name';
    const category = $('category').value.trim() || 'Category';
    const isbn = $('isbn').value.trim() || '978-0-000000-0-0';
    const available = parseInt($('availableCopies').value) || 0;

    $('previewTitle').textContent = title;
    $('previewAuthor').textContent = `by ${author}`;
    $('previewCategory').textContent = category;
    $('previewStock').textContent = `${available} Available`;
    $('previewIsbn').textContent = `ISBN: ${isbn}`;

    const spine = $('previewSpine');
    if (spine) {
        spine.className = `preview-spine ${getCategoryColorClass(category)}`;
    }
}

// Live preview input listeners
['title', 'author', 'isbn', 'category', 'totalCopies', 'availableCopies'].forEach(id => {
    $(id)?.addEventListener('input', updateFormLivePreview);
});

/* ===== 11. FORM SUBMISSION ===== */
$('bookForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = $('title').value.trim();
    const author = $('author').value.trim();
    const isbn = $('isbn').value.trim();
    const category = $('category').value.trim();
    const totalCopies = parseInt($('totalCopies').value);
    const availableCopies = parseInt($('availableCopies').value);

    if (!title || !author || !isbn || !category || isNaN(totalCopies) || isNaN(availableCopies)) {
        showToast('Please fill all required fields correctly', 'error');
        return;
    }

    if (availableCopies > totalCopies) {
        showToast('Available copies cannot exceed total copies', 'error');
        return;
    }

    const payload = {
        title,
        author,
        isbn,
        category,
        totalCopies,
        availableCopies,
        borrowed: availableCopies < totalCopies
    };

    const id = $('bookId').value;
    const isEdit = !!id;
    const url = isEdit ? `${activeApiUrl}/${id}` : activeApiUrl;
    const method = isEdit ? 'PUT' : 'POST';

    const submitBtn = $('submitBtn');
    const submitBtnText = $('submitBtnText');
    const spinner = $('submitSpinner');

    submitBtn.disabled = true;
    spinner?.classList.remove('hidden');
    submitBtnText.textContent = isEdit ? 'Saving...' : 'Adding...';

    try {
        const { ok, json } = await apiCall(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (!ok || !json.success) throw new Error(json.message || 'Operation failed');

        showToast(isEdit ? 'Book updated in catalog!' : 'Book added to catalog!', 'success');
        closeBookModal();
        await loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        spinner?.classList.add('hidden');
        submitBtnText.textContent = isEdit ? 'Update Book' : 'Add Book';
    }
});

/* ===== 12. CUSTOM DELETE CONFIRMATION MODAL ===== */
function openDeleteModal(id) {
    state.deleteTargetId = id;
    const book = state.books.find(b => b.id === id);
    const nameEl = $('deleteBookName');
    if (nameEl) nameEl.textContent = book ? `"${book.title}"` : 'this book';
    $('deleteModalBackdrop').classList.remove('hidden');
}

function closeDeleteModal() {
    $('deleteModalBackdrop').classList.add('hidden');
    state.deleteTargetId = null;
}

async function confirmDeleteBook() {
    const id = state.deleteTargetId;
    if (!id) return;

    const btn = $('confirmDeleteBtn');
    btn.disabled = true;

    try {
        const { ok, json } = await apiCall(`${activeApiUrl}/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(false)
        });

        if (!ok || !json.success) throw new Error(json.message || 'Failed to delete book');

        showToast('Book removed from library catalog', 'success');
        closeDeleteModal();
        if (state.editingId === id) closeBookModal();
        await loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// Fallback signature for deleteBook if called directly
function deleteBook(id) {
    openDeleteModal(id);
}

/* ===== 13. QUICK-VIEW DETAILS MODAL ===== */
function openDetailsModal(id) {
    const book = state.books.find(b => b.id === id);
    if (!book) return;

    const content = $('detailsModalContent');
    if (!content) return;

    const available = Number(book.availableCopies) || 0;
    const total = Number(book.totalCopies) || 1;
    const isAvailable = available > 0;
    const spineClass = getCategoryColorClass(book.category);

    content.innerHTML = `
        <div class="details-view-grid">
            <div class="details-headline-card">
                <div class="details-cover-art ${spineClass}">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/></svg>
                </div>
                <div class="details-info-block">
                    <span class="category-chip" style="width: fit-content; margin-bottom: 0.35rem;">${escapeHtml(book.category || 'General')}</span>
                    <h3>${escapeHtml(book.title)}</h3>
                    <p>by <strong>${escapeHtml(book.author || 'Unknown')}</strong></p>
                </div>
            </div>

            <div class="barcode-sim">|| | ||| || ||| | ||</div>

            <div class="details-meta-table">
                <div class="details-meta-cell">
                    <span class="details-meta-label">ISBN-13 Identifier</span>
                    <span class="details-meta-value" style="font-family: monospace;">${escapeHtml(book.isbn)}</span>
                </div>
                <div class="details-meta-cell">
                    <span class="details-meta-label">Stock Status</span>
                    <span class="details-meta-value">
                        <span class="badge-stock ${isAvailable ? 'available' : 'out'}">
                            <span class="badge-dot"></span>
                            ${isAvailable ? `${available} Copies Available` : 'Out of Stock'}
                        </span>
                    </span>
                </div>
                <div class="details-meta-cell">
                    <span class="details-meta-label">Total Inventory</span>
                    <span class="details-meta-value">${total} copies registered</span>
                </div>
                <div class="details-meta-cell">
                    <span class="details-meta-label">Borrowed Right Now</span>
                    <span class="details-meta-value">${Math.max(0, total - available)} on loan</span>
                </div>
            </div>

            <div class="modal-button-row" style="margin-top: 1rem;">
                <button type="button" class="btn btn-outline" onclick="closeDetailsModal()">Close</button>
                <button type="button" class="btn btn-action btn-return" onclick="returnBook('${book.id}'); closeDetailsModal();">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    <span>Return Copy</span>
                </button>
                <button type="button" class="btn btn-action btn-borrow" onclick="borrowBook('${book.id}'); closeDetailsModal();" ${!isAvailable ? 'disabled' : ''}>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    <span>Borrow Copy</span>
                </button>
            </div>
        </div>
    `;

    $('detailsModalBackdrop').classList.remove('hidden');
}

function closeDetailsModal() {
    $('detailsModalBackdrop').classList.add('hidden');
}

function handleModalBackdropClick(e, backdropId) {
    if (e.target.id === backdropId) {
        $(backdropId).classList.add('hidden');
    }
}

/* ===== 14. EXPORT CATALOG TO CSV / JSON ===== */
function initExportMenu() {
    const btn = $('exportBtn');
    const menu = $('exportMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && e.target !== btn) {
            menu.classList.add('hidden');
        }
    });
}

function exportCatalog(format = 'csv') {
    $('exportMenu')?.classList.add('hidden');
    const books = state.books;
    if (books.length === 0) {
        showToast('No books available to export', 'info');
        return;
    }

    if (format === 'csv') {
        const headers = ['ID', 'Title', 'Author', 'ISBN', 'Category', 'Total Copies', 'Available Copies', 'On Loan'];
        const rows = books.map(b => [
            `"${b.id || ''}"`,
            `"${(b.title || '').replace(/"/g, '""')}"`,
            `"${(b.author || '').replace(/"/g, '""')}"`,
            `"${b.isbn || ''}"`,
            `"${(b.category || '').replace(/"/g, '""')}"`,
            b.totalCopies || 0,
            b.availableCopies || 0,
            (b.totalCopies || 0) - (b.availableCopies || 0)
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        downloadFile(csvContent, 'borrowbox_catalog.csv', 'text/csv;charset=utf-8;');
        showToast('Catalog exported as CSV', 'success');
    } else {
        const jsonContent = JSON.stringify(books, null, 2);
        downloadFile(jsonContent, 'borrowbox_catalog.json', 'application/json');
        showToast('Catalog exported as JSON', 'success');
    }
}

function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* ===== 15. KEYBOARD SHORTCUTS & SEARCH HELPER ===== */
function focusSearch() {
    const input = $('searchInput');
    if (input) {
        input.focus();
        input.select();
    }
}

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Press "/" to focus search (when not in an input)
        if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            e.preventDefault();
            focusSearch();
        }

        // Escape closes any open modal/drawer
        if (e.key === 'Escape') {
            closeBookModal();
            closeDetailsModal();
            closeDeleteModal();
            $('apiPopover')?.classList.add('hidden');
            $('exportMenu')?.classList.add('hidden');
        }
    });
}

/* ===== 16. EVENT LISTENERS ===== */
function setupEventListeners() {
    // Search input with debounce
    let searchDebounce = null;
    const searchInput = $('searchInput');
    const clearSearchBtn = $('clearSearchBtn');

    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        clearSearchBtn?.classList.toggle('hidden', !e.target.value);
        searchDebounce = setTimeout(() => {
            state.filters.search = e.target.value;
            applyFilters();
        }, 220);
    });

    clearSearchBtn?.addEventListener('click', () => {
        if (searchInput) {
            searchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            state.filters.search = '';
            applyFilters();
            searchInput.focus();
        }
    });

    // Category filter
    $('categoryFilter')?.addEventListener('change', (e) => {
        state.filters.category = e.target.value;
        applyFilters();
    });

    // Availability filter
    $('availabilityFilter')?.addEventListener('change', (e) => {
        state.filters.availability = e.target.value;
        applyFilters();
    });

    // Sort By filter
    $('sortBySelect')?.addEventListener('change', (e) => {
        state.filters.sort = e.target.value;
        applyFilters();
    });

    // Reset filters button
    $('resetFiltersBtn')?.addEventListener('click', clearAllFilters);

    // View toggling
    $('viewGridBtn')?.addEventListener('click', () => setView('grid'));
    $('viewTableBtn')?.addEventListener('click', () => setView('table'));

    // Theme toggle
    $('themeToggleBtn')?.addEventListener('click', toggleTheme);

    // Add modal button
    $('openAddModalBtn')?.addEventListener('click', openAddModal);

    // Refresh sync button
    $('refreshCatalogBtn')?.addEventListener('click', async () => {
        showToast('Refreshing catalog...', 'info');
        await loadBooks();
    });
}

function setView(viewMode) {
    state.view = viewMode;
    localStorage.setItem(STORAGE_KEYS.VIEW, viewMode);
    $('viewGridBtn')?.classList.toggle('active', viewMode === 'grid');
    $('viewTableBtn')?.classList.toggle('active', viewMode === 'table');
    renderBooks();
}

/* ===== 17. DATE & INITIALIZATION ===== */
function updateHeroLiveDate() {
    const el = $('heroLiveDate');
    if (!el) return;
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    el.textContent = new Date().toLocaleDateString('en-US', options);
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

/* ===== 18. INITIALIZE APPLICATION ===== */
(async function init() {
    console.log('[BorrowBox] Initializing Professional Design System...');
    initTheme();
    updateHeroLiveDate();
    initApiSwitcher();
    initExportMenu();
    setupEventListeners();
    initKeyboardShortcuts();

    // Set initial view buttons
    if (state.view === 'table') {
        $('viewGridBtn')?.classList.remove('active');
        $('viewTableBtn')?.classList.add('active');
    }

    // Load initial books
    await loadBooks();
})();