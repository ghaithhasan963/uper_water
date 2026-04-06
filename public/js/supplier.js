let socket;
let currentUser = null;
let supplierData = null;

// الاتصال بالـ Socket.io
function initSocket() {
  socket = io({ query: { userId: currentUser._id } });
  socket.on('notification', (notif) => {
    showNotification(notif);
    updateNotificationBadge();
  });
}

function showNotification(notif) {
  // يمكنك استخدام toast أو alert
  alert(notif.title + ': ' + notif.message);
  loadNotifications();
}

async function updateNotificationBadge() {
  const res = await fetch('/api/supplier/notifications');
  const notifs = await res.json();
  const unread = notifs.filter(n => !n.read).length;
  const badge = document.getElementById('notifBadge');
  if (unread > 0) {
    badge.textContent = unread;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

window.showTab = function(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(tab + 'Tab').classList.remove('hidden');
  if (tab === 'dashboard') loadDashboard();
  if (tab === 'orders') loadOrders('pending');
  if (tab === 'notifications') loadNotifications();
  if (tab === 'profile') loadProfile();
  if (tab === 'settings') loadSettings();
  if (tab === 'ratings') loadRatings();
  // update top tabs active state
  document.querySelectorAll('.top-tabs button').forEach(b => b.classList.remove('active'));
  const t = document.getElementById('tab_' + tab);
  if (t) t.classList.add('active');
};

async function loadDashboard() {
  const res = await fetch('/api/supplier/profile');
  const supplier = await res.json();
  supplierData = supplier;
  document.getElementById('currentStatus').textContent = supplier.status;

  const ordersRes = await fetch('/api/supplier/orders?status=pending');
  const pendingOrders = await ordersRes.json();
  document.getElementById('statOrdersPending').textContent = pendingOrders.length;

  const today = new Date().toISOString().split('T')[0];
  const allOrdersRes = await fetch('/api/supplier/orders');
  const allOrders = await allOrdersRes.json();
  const todayOrders = allOrders.filter(o => o.createdAt.startsWith(today));
  document.getElementById('statOrdersToday').textContent = todayOrders.length;

  const completed = allOrders.filter(o => o.status === 'delivered' || o.status === 'completed');
  const earnings = completed.reduce((sum, o) => sum + o.totalPrice, 0);
  document.getElementById('statEarnings').textContent = earnings + ' $';

  // التقييم (افتراضي)
  document.getElementById('statRating').textContent = '4.5';

  // جدول المواعيد القادمة (الطلبات المقبولة المجدولة)
  try {
    const apptRes = await fetch('/api/supplier/appointments');
    const appointments = await apptRes.json();
    const apptContainer = document.getElementById('appointmentsList');
    if (!appointments || appointments.length === 0) {
      apptContainer.innerHTML = '<p class="text-gray-400">لا توجد مواعيد مجدولة</p>';
    } else {
      apptContainer.innerHTML = appointments.map(a => `
        <div class="order-card p-3 rounded-lg flex justify-between items-center">
          <div>
            <p class="font-bold">${a.consumer?.name || 'عميل'}</p>
            <p class="text-sm text-gray-400">${a.consumer?.phone || ''}</p>
            <p class="text-sm text-gray-400">${a.quantity} برميل</p>
            <p class="text-sm text-gray-400">العنوان: ${a.consumerAddress}</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-gray-300">${new Date(a.scheduledAt).toLocaleString()}</p>
            <p class="text-xs text-green-400">${a.status}</p>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading appointments', err);
  }

  const recent = allOrders.slice(0, 5);
  const html = recent.map(o => `
    <div class="order-card p-3 rounded-lg flex justify-between items-center">
      <div>
        <span class="text-sm text-gray-400">طلب #${o._id.slice(-6)}</span>
        <span class="mr-3">${o.quantity} برميل</span>
      </div>
      <span class="px-2 py-1 rounded-full text-xs ${o.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : o.status === 'accepted' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}">${o.status}</span>
    </div>
  `).join('');
  document.getElementById('recentOrders').innerHTML = html;
}

window.setStatus = async function(status) {
  await fetch('/api/supplier/status', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  loadDashboard();
};
async function loadOrders(status) {
  const res = await fetch(`/api/supplier/orders?status=${status}`);
  const orders = await res.json();
  const container = document.getElementById('ordersList');
  container.innerHTML = orders.map(o => `
    <div class="order-card p-4 rounded-lg">
      <div class="flex flex-col gap-2">
        <div class="flex justify-between items-start">
          <div>
            <p class="font-bold">العميل: ${o.consumer?.name || 'غير معروف'}</p>
            <p class="text-sm text-gray-400">الهاتف: ${o.consumer?.phone || ''}</p>
            <p class="text-sm text-gray-400">العنوان: ${o.consumerAddress}</p>
            <p class="text-sm text-gray-400">الموقع: ${o.consumerCity} - ${o.consumerDistrict}</p>
            ${o.consumerLocation?.coordinates ? `<a href="https://maps.google.com/?q=${o.consumerLocation.coordinates[1]},${o.consumerLocation.coordinates[0]}" target="_blank" class="text-blue-400 text-sm">عرض على الخريطة</a>` : ''}
            <p class="text-sm text-gray-400">الكمية: ${o.quantity} برميل | السعر: ${o.totalPrice} $</p>
            <p class="text-xs text-gray-500">الحالة: <span class="text-${o.status === 'pending' ? 'yellow' : o.status === 'accepted' ? 'blue' : o.status === 'enroute' ? 'purple' : 'green'}-400">${o.status}</span></p>
          </div>
          ${o.status === 'pending' ? `
            <div class="flex gap-2">
              <button onclick="acceptOrder('${o._id}')" class="px-3 py-1 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30"><i class="fas fa-check"></i> قبول</button>
              <button onclick="rejectOrder('${o._id}')" class="px-3 py-1 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30"><i class="fas fa-times"></i> رفض</button>
            </div>
          ` : ''}
          ${o.status === 'accepted' ? `
            <div class="flex gap-2">
              <button onclick="updateOrderStatus('${o._id}', 'in_progress')" class="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30">بدء التنفيذ</button>
            </div>
          ` : ''}
          ${o.status === 'in_progress' ? `
            <div class="flex gap-2">
              <button onclick="updateOrderStatus('${o._id}', 'enroute')" class="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30">في الطريق</button>
            </div>
          ` : ''}
          ${o.status === 'enroute' ? `
            <div class="flex gap-2">
              <button onclick="updateOrderStatus('${o._id}', 'delivered')" class="px-3 py-1 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30">وصل</button>
            </div>
          ` : ''}
          ${o.status === 'delivered' ? `
            <div class="flex gap-2">
              <button onclick="updateOrderStatus('${o._id}', 'completed')" class="px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded-lg hover:bg-yellow-600/30">اكتمل</button>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');
}
window.acceptOrder = async function(orderId) {
  const res = await fetch(`/api/supplier/orders/${orderId}/accept`, { method: 'PUT' });
  const data = await res.json();
  if (res.ok) {
    alert(data.message || 'تم قبول الطلب');
    loadOrders('accepted');
  } else {
    alert(data.message || 'فشل قبول الطلب');
    loadOrders('pending');
  }
};

window.rejectOrder = async function(orderId) {
  showTextModal({ title: 'سبب الرفض (اختياري)', placeholder: 'اكتب السبب إن رغبت' }, async (reason) => {
    await fetch(`/api/supplier/orders/${orderId}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    loadOrders('pending');
  });
};

window.updateOrderStatus = async function(orderId, status) {
  const res = await fetch(`/api/supplier/orders/${orderId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  const data = await res.json();
  if (res.ok) {
    alert(data.message || 'تم تحديث حالة الطلب');
  } else {
    alert(data.message || 'فشل تحديث الحالة');
  }
  // إظهار قائمة الطلبات المقبولة لتتبع التقدّم
  loadOrders('accepted');
};

async function loadNotifications() {
  const res = await fetch('/api/supplier/notifications');
  const notifs = await res.json();
  const container = document.getElementById('notificationsList');
  container.innerHTML = notifs.map(n => `
    <div class="glass-card p-4 rounded-lg ${n.read ? 'opacity-60' : 'border-r-4 border-blue-500'}">
      <p class="font-bold">${n.title}</p>
      <p class="text-sm text-gray-300">${n.message}</p>
      <p class="text-xs text-gray-500 mt-1">${new Date(n.createdAt).toLocaleString()}</p>
    </div>
  `).join('');
}

async function loadRatings() {
  try {
    const res = await fetch('/api/supplier/ratings');
    const ratings = await res.json();
    const container = document.getElementById('ratingsList');
    if (!ratings || ratings.length === 0) {
      container.innerHTML = '<p class="text-center text-gray-400">لا توجد تقييمات بعد</p>';
      return;
    }
    container.innerHTML = ratings.map(r => `
      <div class="glass-card p-3 rounded-lg">
        <p class="font-bold">عميل: ${r.consumer?.name || 'غير معروف'}</p>
        <p class="text-sm text-gray-400">الطلب: #${r.order?._id?.slice(-6) || ''} — ${r.punctuality}/5 التزام | ${r.waterQuality}/5 جودة</p>
        <p class="text-sm text-gray-400">نظافة: ${r.cleanliness} — احترافية: ${r.professionalism}</p>
        <p class="text-xs text-gray-300 mt-2">${r.comment || ''}</p>
        <p class="text-xs text-gray-500 mt-1">${new Date(r.createdAt).toLocaleString()}</p>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load supplier ratings', err);
  }
}

async function loadProfile() {
  const res = await fetch('/api/supplier/profile');
  const supplier = await res.json();
  document.querySelector('#profileForm input[name="name"]').value = supplier.user.name;
  document.querySelector('#profileForm input[name="phone"]').value = supplier.user.phone;
  document.querySelector('#profileForm input[name="email"]').value = supplier.user.email || '';
  document.querySelector('#profileForm input[name="tankCapacity"]').value = supplier.tankCapacity;
  document.querySelector('#profileForm input[name="plateNumber"]').value = supplier.plateNumber;
}

window.enableEdit = function() {
  alert('سيتم تفعيل طلب تعديل الملف الشخصي قريباً');
};

async function loadSettings() {
  const res = await fetch('/api/supplier/profile');
  const supplier = await res.json();
  document.querySelector('#settingsForm input[name="minimumOrder"]').value = supplier.minimumOrder;
  document.querySelector('#settingsForm input[name="maximumOrder"]').value = supplier.maximumOrder;
  document.querySelector('#settingsForm textarea[name="discounts"]').value = supplier.discounts || '';
}

document.getElementById('settingsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  await fetch('/api/supplier/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  alert('تم الحفظ');
});

window.onload = async function() {
  const res = await fetch('/api/auth/me');
  if (res.ok) {
    const user = await res.json();
    currentUser = user;
    document.getElementById('supplierName').textContent = user.name;
    initSocket();
    showTab('dashboard');
    updateNotificationBadge();
  } else {
    window.location.href = '/login.html';
  }
};