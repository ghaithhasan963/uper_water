// Authentication functionality

const API_BASE = '/api';

// Register functionality
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
      fullName: document.getElementById('fullName').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
      phone: document.getElementById('phone').value,
      role: document.getElementById('role').value
    };

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.user._id);
        
        // Redirect based on role
        const role = data.user.role;
        if (role === 'supplier') {
          window.location.href = '/supplier/dashboard.html';
        } else if (role === 'consumer') {
          window.location.href = '/consumer/dashboard.html';
        } else if (role === 'admin') {
          window.location.href = '/admin/dashboard.html';
        }
      } else {
        alert('خطأ: ' + data.message);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('حدث خطأ في التسجيل');
    }
  });
}

// Login functionality
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    };

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.user._id);

        // Redirect based on role
        const role = data.user.role;
        if (role === 'supplier') {
          window.location.href = '/supplier/dashboard.html';
        } else if (role === 'consumer') {
          window.location.href = '/consumer/dashboard.html';
        } else if (role === 'admin') {
          window.location.href = '/admin/dashboard.html';
        }
      } else {
        alert('خطأ: ' + data.message);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('حدث خطأ في تسجيل الدخول');
    }
  });
}

// Logout functionality
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  window.location.href = '/index.html';
}

// Check if user is logged in
function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    // Redirect to login if not authenticated
    if (window.location.pathname !== '/login.html' && 
        window.location.pathname !== '/register.html' &&
        window.location.pathname !== '/index.html') {
      window.location.href = '/login.html';
    }
  }
}

// Get auth token
function getAuthToken() {
  return localStorage.getItem('token');
}
