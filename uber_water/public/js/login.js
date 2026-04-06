document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (response.ok) {
      window.location.href = result.redirect || '/';
    } else {
      alert(result.message || 'خطأ في تسجيل الدخول');
    }
  } catch (err) {
    alert('حدث خطأ في الاتصال بالخادم');
  }
});

// إذا كان المستخدم مسجلاً بالفعل، نوجهه إلى لوحة التحكم المناسبة
window.onload = async function() {
  const res = await fetch('/api/auth/me');
  if (res.ok) {
    const user = await res.json();
    if (user.role === 'supplier') window.location.href = '/supplier/dashboard.html';
    else if (user.role === 'consumer') window.location.href = '/consumer/dashboard.html';
    else if (user.role === 'admin') window.location.href = '/admin/dashboard.html';
  }
};