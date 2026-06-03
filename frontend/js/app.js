import { api, onPasswordChangeRequired } from './api.js';
import { decodeToken, setToken, getToken, clearToken } from './utils.js';
import * as announcements from './components/announcements.js';
import * as proposals from './components/proposals.js';
import * as bookings from './components/bookings.js';
import * as users from './components/users.js';

/* ---- DOM refs ---- */
const $ = (id) => document.getElementById(id);
const loginModal   = $('login-modal');
const loginForm    = $('login-form');
const loginError   = $('login-error');
const loginBtn     = $('login-btn');
const resetModal   = $('password-reset-modal');
const resetForm    = $('password-reset-form');
const resetError   = $('reset-error');
const resetSuccess = $('reset-success');
const content      = $('content');
const userInfo     = $('user-info');
const logoutBtn    = $('logout-btn');
const navBtns      = document.querySelectorAll('.nav-btn');
const authOnlyEls  = document.querySelectorAll('.auth-only');
const headerLogo   = document.querySelector('.header-logo');

let currentUser = null;

/* ---- Initialisation ---- */
async function init() {
  onPasswordChangeRequired(showPasswordResetModal);

  // Check for existing valid token before rendering
  const token = getToken();
  if (token) {
    const payload = decodeToken(token);
    if (payload) {
      setAuthenticated(payload);
    } else {
      clearToken();
    }
  }

  // Always start on announcements (already knows auth state)
  announcements.init(currentUser);
  await announcements.render(content);
}

/* ---- Auth state ---- */
function setAuthenticated(payload) {
  currentUser = payload;
  const role = currentUser.role || 'member';

  loginBtn.classList.add('hidden');
  logoutBtn.classList.remove('hidden');
  userInfo.classList.remove('hidden');
  userInfo.textContent = `${currentUser.sub?.slice(0, 8) || '使用者'} (${role === 'officer' ? '幹部' : '成員'})`;

  authOnlyEls.forEach((el) => el.classList.remove('hidden'));

  document.querySelectorAll('.officer-only').forEach((el) => {
    el.classList.toggle('hidden', role !== 'officer');
  });

  announcements.init(currentUser);
}

function setUnauthenticated() {
  currentUser = null;
  clearToken();

  loginBtn.classList.remove('hidden');
  logoutBtn.classList.add('hidden');
  userInfo.classList.add('hidden');

  authOnlyEls.forEach((el) => el.classList.add('hidden'));

  announcements.init(null);

  // Switch to announcements if on an auth-only view
  const active = document.querySelector('.nav-btn.active');
  if (active && active.classList.contains('auth-only')) {
    navBtns.forEach((b) => b.classList.remove('active'));
    announcements.render(content);
  }
}

/* ---- Login modal ---- */
loginBtn.addEventListener('click', () => {
  loginModal.classList.remove('hidden');
  loginForm.reset();
  loginError.textContent = '';
});

loginModal.addEventListener('click', (e) => {
  if (e.target === loginModal) loginModal.classList.add('hidden');
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const fd = new FormData(loginForm);
  try {
    const res = await api.post('/auth/login', {
      username: fd.get('username'),
      password: fd.get('password'),
    });
    setToken(res.access_token);
    loginForm.reset();
    loginModal.classList.add('hidden');

    const payload = decodeToken(res.access_token);
    setAuthenticated(payload);

    // Re-render the current view with the authenticated user
    const active = document.querySelector('.nav-btn.active');
    if (active) await navigateTo(active.dataset.view);
  } catch (err) {
    loginError.textContent = err.message;
  }
});

/* ---- Logout ---- */
logoutBtn.addEventListener('click', () => {
  setUnauthenticated();
});

/* ---- Logo click → announcements ---- */
headerLogo.style.cursor = 'pointer';
headerLogo.addEventListener('click', () => {
  navBtns.forEach((b) => b.classList.remove('active'));
  navigateTo('announcements');
});

/* ---- Navigation ---- */
navBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    navBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    navigateTo(btn.dataset.view);
  });
});

async function navigateTo(view) {
  content.innerHTML = '<div class="loading"><div class="spinner"></div><p>載入中…</p></div>';

  try {
    switch (view) {
      case 'announcements':
        announcements.init(currentUser);
        await announcements.render(content);
        break;
      case 'proposals':
        proposals.init(currentUser);
        await proposals.render(content);
        break;
      case 'bookings':
        bookings.init(currentUser);
        await bookings.render(content);
        break;
      case 'users':
        users.init(currentUser);
        await users.render(content);
        break;
      default:
        content.innerHTML = '<p class="placeholder">Select a view.</p>';
    }
  } catch (err) {
    if (!err.message.includes('Password change required')) {
      content.innerHTML = `<p class="error">${err.message}</p>`;
    }
  }
}

/* ---- Forced Password Reset Modal ---- */
function showPasswordResetModal() {
  if (!resetModal.classList.contains('hidden')) return;
  resetModal.classList.remove('hidden');
  resetForm.reset();
  resetError.textContent = '';
  resetSuccess.textContent = '';
  resetSuccess.classList.add('hidden');
}

resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  resetError.textContent = '';
  resetSuccess.textContent = '';
  resetSuccess.classList.add('hidden');

  const fd = new FormData(resetForm);
  const data = {
    old_password: fd.get('old_password'),
    new_password: fd.get('new_password'),
  };

  try {
    await api.post('/auth/change-password', data);
    resetForm.reset();
    resetSuccess.textContent = 'Password changed successfully.';
    resetSuccess.classList.remove('hidden');

    setTimeout(() => {
      resetModal.classList.add('hidden');
      const active = document.querySelector('.nav-btn.active');
      if (active) navigateTo(active.dataset.view);
    }, 1200);
  } catch (err) {
    resetError.textContent = err.message;
  }
});

/* ---- Bootstrap ---- */
document.addEventListener('DOMContentLoaded', init);
