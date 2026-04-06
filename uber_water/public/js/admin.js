let socket;

function initSocket() {
  socket = io();
  socket.emit('joinAdmin');
  socket.on('activity', (activity) => {
    addActivityToLog(activity);
  });
}
window.showTab = function(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(tab + 'Tab').classList.remove('hidden');
  if (tab === 'dashboard') loadDashboard();
  if (tab === 'users') loadUsers();
  if (tab === 'pending') loadPendingUsers();
  if (tab === 'edits') loadPendingEdits();
  if (tab === 'reports') loadReports();
  if (tab === 'activity') loadActivityLogs();
  if (tab === 'orders') loadAllOrders();
  // update top tabs active state
  document.querySelectorAll('.top-tabs button').forEach(b => b.classList.remove('active'));
  const t = document.getElementById('tab_' + tab);
  if (t) t.classList.add('active');
};
async function loadDashboard() {
  const usersRes = await fetch('/api/admin/users');
  const users = await usersRes.json();
  document.getElementById('statTotalUsers').textContent = users.length;
  document.getElementById('statPendingUsers').textContent = users.filter(u => u.status === 'pending').length;
  // لاحقاً يمكن جلب الطلبات النشطة والبلاغات من مسارات منفصلة
  document.getElementById('statActiveOrders').textContent = '0';
  document.getElementById('statReports').textContent = '0';

  const pendingUsers = users.filter(u => u.status === 'pending');
  const html = pendingUsers.slice(0, 5).map(u => `
    <div class="log-item p-3 rounded-lg flex justify-between items-center">
      <span>${u.name}</span>
      <span class="text-yellow-400">قيد المراجعة</span>
    </div>
  `).join('');
  document.getElementById('recentActivity').innerHTML = html || '<p class="text-gray-400">لا توجد طلبات معلقة</p>';
}

window.loadUsers = async function() {
  const role = document.getElementById('userRoleFilter').value;
  const status = document.getElementById('userStatusFilter').value;
  let url = '/api/admin/users?';
  if (role) url += `role=${role}&`;
  if (status) url += `status=${status}`;
  const res = await fetch(url);
  const users = await res.json();
  const container = document.getElementById('usersList');
  if (users.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-center">لا يوجد مستخدمون</p>';
    return;
  }
  container.innerHTML = users.map(u => `
    <div class="user-item p-4 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
      <div>
        <p class="font-bold">${u.name}</p>
        <p class="text-sm text-gray-400">${u.phone} | ${u.email || 'لا يوجد'}</p>
        <p class="text-xs">الدور: ${u.role} | الحالة: <span class="text-${u.status === 'active' ? 'green' : u.status === 'pending' ? 'yellow' : 'red'}-400">${u.status}</span></p>
      </div>
      <div class="flex gap-2">
        <button onclick="viewUserDetails('${u._id}')" class="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30">عرض</button>
        <button onclick="toggleSuspend('${u._id}', '${u.status}')" class="px-3 py-1 bg-${u.status === 'suspended' ? 'green' : 'red'}-600/20 text-${u.status === 'suspended' ? 'green' : 'red'}-400 rounded-lg hover:bg-${u.status === 'suspended' ? 'green' : 'red'}-600/30">${u.status === 'suspended' ? 'إلغاء التعليق' : 'تعليق'}</button>
        <button onclick="resetPassword('${u._id}')" class="px-3 py-1 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30">إعادة تعيين</button>
      </div>
    </div>
  `).join('');
};

window.toggleSuspend = async function(userId, currentStatus) {
  if (!confirm('تأكيد العملية؟')) return;
  const res = await fetch(`/api/admin/users/${userId}/toggle-suspend`, { method: 'PUT' });
  if (res.ok) { alert('تم التحديث'); loadUsers(); }
};

window.resetPassword = async function(userId) {
  if (!confirm('سيتم إرسال كلمة مرور جديدة للمستخدم. استمر؟')) return;
  const res = await fetch('/api/admin/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  if (res.ok) alert('تم إرسال كلمة مرور جديدة');
};

// تحميل طلبات التسجيل المعلقة مع التفاصيل الكاملة
async function loadPendingUsers() {
  const res = await fetch('/api/admin/pending-users');
  const users = await res.json();
  const container = document.getElementById('pendingList');
  if (users.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-center">لا توجد طلبات معلقة</p>';
    return;
  }
  container.innerHTML = users.map(u => {
    let detailsHtml = '';
    if (u.role === 'supplier' && u.supplierDetails) {
      const s = u.supplierDetails;
      detailsHtml = `
        <p class="text-sm"><span class="text-gray-400">سعة الخزان:</span> ${s.tankCapacity} برميل</p>
        <p class="text-sm"><span class="text-gray-400">رقم اللوحة:</span> ${s.plateNumber}</p>
        ${s.tankImage ? `<img src="${s.tankImage}" class="h-16 w-16 object-cover rounded mt-1">` : ''}
        <p class="text-sm"><span class="text-gray-400">مناطق الخدمة:</span></p>
        <ul class="list-disc list-inside text-xs">
          ${s.serviceAreas.map(a => `<li>${a.city} - ${a.district}: ${a.pricePerBarrel} $</li>`).join('')}
        </ul>
      `;
    } else if (u.role === 'consumer' && u.consumerDetails) {
      const c = u.consumerDetails;
      detailsHtml = `
        <p class="text-sm"><span class="text-gray-400">العنوان:</span> ${c.address}</p>
        <p class="text-sm"><span class="text-gray-400">المدينة:</span> ${c.city}</p>
        <p class="text-sm"><span class="text-gray-400">المنطقة:</span> ${c.district}</p>
        <p class="text-sm"><span class="text-gray-400">الموقع:</span> [${c.location.coordinates[0]}, ${c.location.coordinates[1]}]</p>
      `;
    }
    return `
      <div class="user-item p-4 rounded-lg">
        <p class="font-bold">${u.name}</p>
        <p class="text-sm text-gray-400">${u.phone} | ${u.email || 'لا يوجد'}</p>
        <p class="text-xs mb-2">الدور: ${u.role}</p>
        ${detailsHtml}
        <div class="flex gap-2 mt-3">
          <button onclick="reviewUser('${u._id}', 'approve')" class="px-4 py-1 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30">قبول</button>
          <button onclick="reviewUser('${u._id}', 'reject')" class="px-4 py-1 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30">رفض</button>
        </div>
      </div>
    `;
  }).join('');
}

window.reviewUser = async function(userId, action) {
  if (action === 'reject') {
    showTextModal({ title: 'سبب الرفض', placeholder: 'اكتب سبب الرفض' }, async (reason) => {
      if (reason === null) return;
      const res = await fetch(`/api/admin/users/${userId}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason })
      });
      if (res.ok) { alert('تمت المعالجة'); loadPendingUsers(); }
    });
    return;
  }
  const res = await fetch(`/api/admin/users/${userId}/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, reason: '' })
  });
  if (res.ok) { alert('تمت المعالجة'); loadPendingUsers(); }
};

async function loadPendingEdits() {
  const res = await fetch('/api/admin/pending-edits');
  const edits = await res.json();
  const container = document.getElementById('editsList');
  if (edits.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-center">لا توجد طلبات تعديل</p>';
    return;
  }
  container.innerHTML = edits.map(e => {
    const userInfo = [];
    if (e.user) {
      userInfo.push(`الاسم: ${e.user.name}`);
      if (e.user.email) userInfo.push(`البريد: ${e.user.email}`);
      if (e.user.phone) userInfo.push(`الهاتف: ${e.user.phone}`);
    }
    if (e.consumerDetails) {
      userInfo.push(`العنوان: ${e.consumerDetails.address || ''}`);
      userInfo.push(`المدينة: ${e.consumerDetails.city || ''}`);
      userInfo.push(`المنطقة: ${e.consumerDetails.district || ''}`);
    }
    if (e.supplierDetails) {
      userInfo.push(`لوحة: ${e.supplierDetails.plateNumber || ''}`);
      userInfo.push(`سعة: ${e.supplierDetails.tankCapacity || ''}`);
    }
    return `
    <div class="user-item p-4 rounded-lg">
      <p class="font-bold">المستخدم: ${e.user?.name}</p>
      <p class="text-xs text-gray-400">${userInfo.filter(Boolean).join(' | ')}</p>
      <p class="text-sm mt-2">الحقل: ${e.field}</p>
      <p class="text-sm text-gray-400">القيمة القديمة: ${JSON.stringify(e.oldValue)}</p>
      <p class="text-sm text-green-400">القيمة الجديدة: ${JSON.stringify(e.newValue)}</p>
      <div class="flex gap-2 mt-2">
        <button onclick="reviewEdit('${e._id}', 'approve')" class="px-4 py-1 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30">موافقة</button>
        <button onclick="reviewEdit('${e._id}', 'reject')" class="px-4 py-1 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30">رفض</button>
        <button onclick="viewUserDetails('${e.user?._id}')" class="px-4 py-1 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30">عرض المستخدم</button>
      </div>
    </div>
  `}).join('');
}

window.viewUserDetails = async function(userId) {
  if (!userId) return alert('لا توجد معلومات المستخدم');
  const res = await fetch(`/api/admin/users/${userId}`);
  if (!res.ok) return alert('فشل جلب بيانات المستخدم');
  const u = await res.json();
  // build details HTML
  let html = `<div class="p-2">`;
  html += `<h4 class="font-bold text-lg mb-2">${u.name}</h4>`;
  html += `<p class="text-sm">${u.phone || ''} | ${u.email || ''}</p>`;
  html += `<p class="text-xs text-gray-500">الدور: ${u.role} | الحالة: ${u.status}</p>`;
  if (u.consumerDetails) {
    const c = u.consumerDetails;
    html += `<hr class="my-2">`;
    html += `<p><strong>العنوان:</strong> ${c.address || ''}</p>`;
    html += `<p><strong>المدينة:</strong> ${c.city || ''}</p>`;
    html += `<p><strong>المنطقة:</strong> ${c.district || ''}</p>`;
    if (c.location && c.location.coordinates) html += `<p><strong>الموقع:</strong> [${c.location.coordinates[0]}, ${c.location.coordinates[1]}]</p>`;
  }
  if (u.supplierDetails) {
    const s = u.supplierDetails;
    html += `<hr class="my-2">`;
    html += `<p><strong>رقم اللوحة:</strong> ${s.plateNumber || ''}</p>`;
    html += `<p><strong>سعة الخزان:</strong> ${s.tankCapacity || ''}</p>`;
    if (s.serviceAreas && s.serviceAreas.length) {
      html += `<p class="mt-2 font-semibold">مناطق الخدمة:</p><ul class="list-disc ml-6 text-sm">`;
      s.serviceAreas.forEach(a => { html += `<li>${a.city} - ${a.district}: ${a.pricePerBarrel}</li>`; });
      html += `</ul>`;
    }
  }
  html += `</div>`;

  showModal({ title: 'معلومات المستخدم', html, widthClass: 'md:w-1/2', actions: [
    { label: 'إغلاق', className: 'bg-gray-200 text-black', onClick: (m) => m.remove() }
  ] });
};

window.reviewEdit = async function(editId, action) {
  const res = await fetch(`/api/admin/pending-edits/${editId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
  if (res.ok) { alert('تمت المراجعة'); loadPendingEdits(); }
};

async function loadReports() {
  const res = await fetch('/api/admin/reports');
  const reports = await res.json();
  const container = document.getElementById('reportsList');
  if (reports.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-center">لا توجد بلاغات</p>';
    return;
  }
  container.innerHTML = reports.map(r => `
    <div class="user-item p-4 rounded-lg">
      <p class="font-bold">مبلغ: ${r.reporter?.name} | مبلغ عنه: ${r.reportedUser?.name}</p>
      <p class="text-sm">السبب: ${r.reason}</p>
      <p class="text-sm text-gray-400">${r.details || 'لا يوجد تفاصيل'}</p>
      <div class="flex gap-2 mt-2">
        <button onclick="handleReport('${r._id}', 'resolve')" class="px-4 py-1 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30">حل</button>
        <button onclick="handleReport('${r._id}', 'dismiss')" class="px-4 py-1 bg-gray-600/20 text-gray-400 rounded-lg hover:bg-gray-600/30">تجاهل</button>
      </div>
    </div>
  `).join('');
}

window.handleReport = async function(reportId, action) {
  const res = await fetch(`/api/admin/reports/${reportId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
  if (res.ok) { alert('تمت المعالجة'); loadReports(); }
};

async function loadActivityLogs() {
  const res = await fetch('/api/admin/activity');
  const logs = await res.json();
  displayActivityLogs(logs);
}

function displayActivityLogs(logs) {
  const container = document.getElementById('activityLogs');
  if (logs.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-center">لا توجد نشاطات</p>';
    return;
  }
  container.innerHTML = logs.map(log => `
    <div class="log-item p-2 rounded-lg text-sm">
      <span class="text-gray-400">${new Date(log.createdAt).toLocaleString()}</span> - 
      <span>${log.user?.name || 'نظام'}</span> - 
      <span>${log.action}</span>
      <span class="text-xs text-gray-500">${JSON.stringify(log.details)}</span>
    </div>
  `).join('');
}

function addActivityToLog(activity) {
  const container = document.getElementById('activityLogs');
  if (container) {
    const newDiv = document.createElement('div');
    newDiv.className = 'log-item p-2 rounded-lg text-sm';
    newDiv.innerHTML = `<span class="text-gray-400">${new Date().toLocaleString()}</span> - ${activity.userName || 'نظام'} - ${activity.action}`;
    container.prepend(newDiv);
    if (container.children.length > 50) container.removeChild(container.lastChild);
  }
}

window.onload = async function() {
  const res = await fetch('/api/auth/me');
  if (res.ok) {
    const user = await res.json();
    document.getElementById('adminName').textContent = user.name;
    initSocket();
    showTab('dashboard');
  } else {
    window.location.href = '/login.html';
  }
};
async function loadAllOrders() {
  const status = document.getElementById('orderStatusFilter')?.value;
  let url = '/api/admin/orders';
  // بشكل افتراضي نعرض طلبات آخر 24 ساعة لتكون مشابهة لتبويب النشاط
  if (status) {
    url += `?status=${status}`;
  } else {
    url += `?last24=true`;
  }
  const res = await fetch(url);
  const orders = await res.json();
  const container = document.getElementById('allOrdersList');
  if (orders.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-center">لا توجد طلبات</p>';
    return;
  }
  container.innerHTML = orders.map(o => `
    <div class="user-item p-4 rounded-lg">
      <p class="font-bold">مستهلك: ${o.consumer?.name} | مورد: ${o.supplier?.name}</p>
      <p class="text-sm">الكمية: ${o.quantity} | السعر: ${o.totalPrice} $</p>
      <p class="text-sm">العنوان: ${o.consumerAddress} - ${o.consumerCity} ${o.consumerDistrict}</p>
      <p class="text-sm">الحالة: <span class="text-${o.status === 'delivered' ? 'green' : o.status === 'cancelled' ? 'red' : 'yellow'}">${o.status}</span></p>
      <p class="text-xs text-gray-400">تاريخ الطلب: ${new Date(o.createdAt).toLocaleString()}</p>
      ${o.rating ? `<p class="text-xs text-gray-400">تم تقييمه</p>` : ''}
    </div>
  `).join('');
}