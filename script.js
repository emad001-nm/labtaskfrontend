/* =========================================================
   API CONFIGURATION
   Local:      http://localhost:8080/api/books
   Production: https://borrowbox-backend-XXXX.onrender.com/api/books
   Auto-detect based on browser hostname.
   ========================================================= */
const API_CONFIG = {
    LOCAL: 'http://localhost:8080/api/books',
    PRODUCTION: 'https://borrowbox-backend-imbv.onrender.com/api/books'  // ← তোমার Render URL
};

const IS_LOCAL = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
const API_URL = IS_LOCAL ? API_CONFIG.LOCAL : API_CONFIG.PRODUCTION;

console.log('[BorrowBox] API URL:', API_URL);

// Basic auth credentials for protected operations (POST/PUT/DELETE)
const AUTH_HEADER = 'Basic ' + btoa('admin:admin123');

const getAuthHeaders = (json = true) => {
    const headers = { 'Authorization': AUTH_HEADER };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
};

const $ = (id) => document.getElementById(id);

// ---------- Toast ----------
function showToast(msg, type = 'success') {
    const t = $('toast');
    t.textContent = msg;
    t.className = `toast show ${type}`;
    setTimeout(() => t.className = 'toast', 2500);
}

// ---------- Fetch all books ----------
async function loadBooks() {
    const list = $('bookList');
    list.innerHTML = 'Loading...';
    try {
        const res = await fetch(API_URL);
        const json = await res.json();
        if (!json.success) throw new Error(json.message);

        if (json.data.length === 0) {
            list.innerHTML = '<p style="color:#888">No books yet. Add one to get started!</p>';
            return;
        }

        list.innerHTML = json.data.map(book => `
            <div class="book-item">
                <div class="book-info">
                    <h3>${escapeHtml(book.title)}
                        <span class="badge ${book.availableCopies > 0 ? 'available' : 'out'}">
                            ${book.availableCopies > 0 ? 'Available' : 'Out'}
                        </span>
                    </h3>
                    <p><strong>${escapeHtml(book.author)}</strong> • ${escapeHtml(book.category)}</p>
                    <p>ISBN: ${escapeHtml(book.isbn)} • Available: ${book.availableCopies}/${book.totalCopies}</p>
                </div>
                <div class="book-actions">
                    <button class="borrow-btn" onclick="borrowBook('${book.id}')">Borrow</button>
                    <button class="return-btn" onclick="returnBook('${book.id}')">Return</button>
                    <button class="edit-btn" onclick='editBook(${JSON.stringify(book).replace(/'/g, "&apos;")})'>Edit</button>
                    <button class="delete-btn" onclick="deleteBook('${book.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        list.innerHTML = `<p style="color:#ef4444">Error: ${err.message}</p>`;
    }
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}

// ---------- Form submit ----------
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

    try {
        const res = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
            throw new Error(json.message || 'Operation failed');
        }

        showToast(json.message, 'success');
        resetForm();
        loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// ---------- Edit ----------
function editBook(book) {
    $('bookId').value = book.id;
    $('title').value = book.title;
    $('author').value = book.author;
    $('isbn').value = book.isbn;
    $('category').value = book.category;
    $('totalCopies').value = book.totalCopies;
    $('availableCopies').value = book.availableCopies;
    $('formTitle').textContent = 'Edit Book';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- Reset ----------
function resetForm() {
    $('bookForm').reset();
    $('bookId').value = '';
    $('formTitle').textContent = 'Add New Book';
}

// ---------- Delete ----------
async function deleteBook(id) {
    if (!confirm('Delete this book?')) return;
    try {
        const res = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(false)
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message);
        showToast('Book deleted', 'success');
        loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ---------- Borrow ----------
async function borrowBook(id) {
    try {
        const res = await fetch(`${API_URL}/${id}/borrow`, {
            method: 'POST',
            headers: getAuthHeaders(false)
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message);
        showToast('Borrowed!', 'success');
        loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ---------- Return ----------
async function returnBook(id) {
    try {
        const res = await fetch(`${API_URL}/${id}/return`, {
            method: 'POST',
            headers: getAuthHeaders(false)
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message);
        showToast('Returned!', 'success');
        loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ---------- Init ----------
loadBooks();