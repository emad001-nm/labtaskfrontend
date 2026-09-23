/* =========================================================
   BORROWBOX — FRONTEND LOGIC
   Auto-detects local vs production backend.
   ========================================================= */

/* ===== API CONFIGURATION ===== */
const API_CONFIG = {
    LOCAL: 'http://localhost:8080/api/books',
    PRODUCTION: 'https://labtaskbackend.onrender.com/api/books'
};

const IS_LOCAL = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
const API_URL = IS_LOCAL ? API_CONFIG.LOCAL : API_CONFIG.PRODUCTION;

console.log('[BorrowBox] API URL:', API_URL);

/* ===== AUTH (for POST/PUT/DELETE) ===== */
const AUTH_HEADER = 'Basic ' + btoa('admin:admin123');

const getAuthHeaders = (json = true) => {
    const headers = { 'Authorization': AUTH_HEADER };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
};

/* ===== DOM HELPERS ===== */
const $ = (id) => document.getElementById(id);

/* ===== STATE ===== */
let state = {
    books: [],
    filteredBooks: [],
    editingId: null,
    filters: {
        search: '',
        category: '',
        availability: ''
    }
};

/* =========================================================
   API STATUS INDICATOR
   ========================================================= */
function setApiStatus(isOnline) {
    const dot = $('apiStatus');
    const text = $('apiStatusText');
    if (!dot || !text) return;

    dot.classList.toggle('online', isOnline);
    dot.classList.toggle('offline', !isOnline);
    text.textContent = isOnline ? 'Connected' : 'Offline';
}

/* =========================================================
   TOAST NOTIFICATION
   ========================================================= */
let toastTimer = null;
function showToast(message, type = 'success') {
    const t = $('toast');
    clearTimeout(toastTimer);
    t.textContent = message;
    t.className = `toast ${type}`;
    t.classList.remove('hidden');

    toastTimer = setTimeout(() => {
        t.classList.add('hidden');
    }, 3200);
}

/* =========================================================
   LOADING / EMPTY STATES
   ========================================================= */
function setLoading(isLoading) {
    $('loadingState').classList.toggle('hidden', !isLoading);
    if (isLoading) {
        $('emptyState').classList.add('hidden');
        $('bookList').innerHTML = '';
    }
}

function showEmpty(show) {
    $('emptyState').classList.toggle('hidden', !show);
}

/* =========================================================
   API CALL HELPER
   ========================================================= */
async function apiCall(url, options = {}) {
    try {
        const res = await fetch(url, options);
        const json = await res.json();
        setApiStatus(true);
        return { ok: res.ok, json };
    } catch (err) {
        setApiStatus(false);
        throw new Error('Failed to connect to server');
    }
}

/* =========================================================
   LOAD BOOKS
   ========================================================= */
async function loadBooks() {
    setLoading(true);
    try {
        const { ok, json } = await apiCall(API_URL);
        if (!ok || !json.success) throw new Error(json.message || 'Failed to load');

        state.books = json.data || [];
        applyFilters();
        updateStats();
        updateCategoryFilter();
    } catch (err) {
        console.error('Load books error:', err);
        showToast(err.message, 'error');
        $('bookList').innerHTML = '';
        state.books = [];
        state.filteredBooks = [];
        renderBooks();
        updateStats();
    } finally {
        setLoading(false);
    }
}

/* =========================================================
   FILTERS
   ========================================================= */
function applyFilters() {
    const { search, category, availability } = state.filters;
    const s = search.toLowerCase().trim();

    state.filteredBooks = state.books.filter(book => {
        const matchSearch = !s ||
            (book.title || '').toLowerCase().includes(s) ||
            (book.author || '').toLowerCase().includes(s) ||
            (book.isbn || '').toLowerCase().includes(s);

        const matchCategory = !category || book.category === category;

        const matchAvailability = !availability ||
            (availability === 'available' && book.availableCopies > 0) ||
            (availability === 'out' && book.availableCopies <= 0);

        return matchSearch && matchCategory && matchAvailability;
    });

    renderBooks();
}

function updateCategoryFilter() {
    const categories = [...new Set(state.books.map(b => b.category).filter(Boolean))].sort();
    const select = $('categoryFilter');
    const current = select.value;

    select.innerHTML = '<option value="">All Categories</option>' +
        categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

    select.value = current;
}

/* =========================================================
   RENDER BOOKS
   ========================================================= */
function renderBooks() {
    const list = $('bookList');
    const books = state.filteredBooks;

    $('bookCount').textContent = books.length;

    if (books.length === 0) {
        list.innerHTML = '';
        showEmpty(true);
        return;
    }

    showEmpty(false);

    list.innerHTML = books.map(book => `
        <div class="book-item">
            <div class="book-info">
                <h3>
                    ${escapeHtml(book.title)}
                    <span class="badge ${book.availableCopies > 0 ? 'available' : 'out'}">
                        ${book.availableCopies > 0 ? 'Available' : 'Out'}
                    </span>
                </h3>
                <p><strong>${escapeHtml(book.author)}</strong> &middot; ${escapeHtml(book.category)}</p>
                <div class="meta-row">
                    <span>📖 ISBN: ${escapeHtml(book.isbn)}</span>
                    <span>📦 ${book.availableCopies}/${book.totalCopies} copies</span>
                </div>
            </div>
            <div class="book-actions">
                <button class="borrow-btn" onclick="borrowBook('${book.id}')" ${book.availableCopies <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>Borrow</button>
                <button class="return-btn" onclick="returnBook('${book.id}')">Return</button>
                <button class="edit-btn" onclick='editBook(${JSON.stringify(book).replace(/'/g, "&apos;")})'>Edit</button>
                <button class="delete-btn" onclick="deleteBook('${book.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

/* =========================================================
   STATS
   ========================================================= */
function updateStats() {
    const books = state.books;
    const total = books.length;
    const available = books.filter(b => b.availableCopies > 0).length;
    const out = books.filter(b => b.availableCopies <= 0).length;
    const categories = new Set(books.map(b => b.category).filter(Boolean)).size;

    animateNumber($('statTotal'), total);
    animateNumber($('statAvailable'), available);
    animateNumber($('statOut'), out);
    animateNumber($('statCategories'), categories);
}

function animateNumber(el, target) {
    const current = parseInt(el.textContent) || 0;
    if (current === target) {
        el.textContent = target;
        return;
    }

    const duration = 400;
    const start = performance.now();

    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const value = Math.round(current + (target - current) * progress);
        el.textContent = value;
        if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

/* =========================================================
   FORM SUBMIT
   ========================================================= */
$('bookForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = $('bookId').value;
    const payload = {
        title: $('title').value.trim(),
        author: $('author').value.trim(),
        isbn: $('isbn').value.trim(),
        category: $('category').value.trim(),
        totalCopies: parseInt($('totalCopies').value),
        availableCopies: parseInt($('availableCopies').value),
        borrowed: false
    };

    const url = id ? `${API_URL}/${id}` : API_URL;
    const method = id ? 'PUT' : 'POST';

    const submitBtn = $('submitBtn');
    const submitBtnText = $('submitBtnText');
    const isEdit = !!id;

    submitBtn.disabled = true;
    submitBtnText.textContent = isEdit ? 'Updating...' : 'Adding...';

    try {
        const { ok, json } = await apiCall(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (!ok || !json.success) {
            throw new Error(json.message || 'Operation failed');
        }

        showToast(isEdit ? 'Book updated successfully!' : 'Book added successfully!', 'success');
        resetForm();
        await loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtnText.textContent = isEdit ? 'Update Book' : 'Add Book';
    }
});

/* =========================================================
   EDIT MODE
   ========================================================= */
function editBook(book) {
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
    $('cancelEditBtn').classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('title').focus();
}

function resetForm() {
    state.editingId = null;
    $('bookForm').reset();
    $('bookId').value = '';
    $('formTitle').textContent = 'Add New Book';
    $('submitBtnText').textContent = 'Add Book';
    $('cancelEditBtn').classList.add('hidden');
}

$('cancelEditBtn').addEventListener('click', () => {
    resetForm();
    showToast('Edit cancelled', 'info');
});

/* =========================================================
   DELETE
   ========================================================= */
async function deleteBook(id) {
    const book = state.books.find(b => b.id === id);
    const name = book ? `"${book.title}"` : 'this book';

    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;

    try {
        const { ok, json } = await apiCall(`${API_URL}/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(false)
        });

        if (!ok || !json.success) throw new Error(json.message || 'Delete failed');

        showToast('Book deleted', 'success');
        if (state.editingId === id) resetForm();
        await loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* =========================================================
   BORROW
   ========================================================= */
async function borrowBook(id) {
    try {
        const { ok, json } = await apiCall(`${API_URL}/${id}/borrow`, {
            method: 'POST',
            headers: getAuthHeaders(false)
        });

        if (!ok || !json.success) throw new Error(json.message || 'Borrow failed');

        showToast('Book borrowed successfully!', 'success');
        await loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* =========================================================
   RETURN
   ========================================================= */
async function returnBook(id) {
    try {
        const { ok, json } = await apiCall(`${API_URL}/${id}/return`, {
            method: 'POST',
            headers: getAuthHeaders(false)
        });

        if (!ok || !json.success) throw new Error(json.message || 'Return failed');

        showToast('Book returned successfully!', 'success');
        await loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* =========================================================
   FILTERS EVENTS
   ========================================================= */
let searchDebounce = null;
$('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
        state.filters.search = e.target.value;
        applyFilters();
    }, 250);
});

$('categoryFilter').addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    applyFilters();
});

$('availabilityFilter').addEventListener('change', (e) => {
    state.filters.availability = e.target.value;
    applyFilters();
});

/* =========================================================
   UTILITIES
   ========================================================= */
function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

/* =========================================================
   INIT
   ========================================================= */
(async function init() {
    console.log('[BorrowBox] Initializing...');
    await loadBooks();
})();