let socket;
let currentUser = null;
let consumerData = null;
let map, marker;

function initSocket() {
  socket = io({ query: { userId: currentUser._id } });
  socket.on('notification', (notif) => {
    showNotification(notif);
    updateNotificationBadge();
  });
}

function showNotification(notif) {
  alert(notif.title + ': ' + notif.message);
  loadNotifications();
}

async function updateNotificationBadge() {
  const res = await fetch('/api/consumer/notifications');
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
  if (tab === 'newOrder') loadCities();
  if (tab === 'orders') loadConsumerOrders();
  if (tab === 'notifications') loadNotifications();
  if (tab === 'profile') loadProfile();
  if (tab === 'ratings') loadMyRatings();
  // update top tabs active state
  document.querySelectorAll('.top-tabs button').forEach(b => b.classList.remove('active'));
  const t = document.getElementById('tab_' + tab);
  if (t) t.classList.add('active');
};

async function loadDashboard() {
  const ordersRes = await fetch('/api/consumer/orders');
  const orders = await ordersRes.json();
  const pending = orders.filter(o => ['pending', 'accepted', 'enroute'].includes(o.status)).length;
  const completed = orders.filter(o => o.status === 'delivered').length;
  const totalSpent = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.totalPrice, 0);
  document.getElementById('statOrdersPending').textContent = pending;
  document.getElementById('statOrdersCompleted').textContent = completed;
  document.getElementById('statTotalSpent').textContent = totalSpent + ' $';

  const recent = orders.slice(0, 5);
  document.getElementById('recentOrders').innerHTML = recent.map(o => `
    <div class="order-card p-3 rounded-lg flex justify-between items-center">
      <span class="text-sm text-gray-400">طلب #${o._id.slice(-6)}</span>
      <span>${o.quantity} برميل</span>
      <span class="px-2 py-1 rounded-full text-xs ${o.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : o.status === 'accepted' ? 'bg-blue-500/20 text-blue-400' : o.status === 'enroute' ? 'bg-purple-500/20 text-purple-400' : o.status === 'delivered' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${o.status}</span>
    </div>
  `).join('');
}

async function loadCities() {
  const res = await fetch('/api/auth/cities');
  const cities = await res.json();
  const citySelect = document.getElementById('filterCity');
  citySelect.innerHTML = '<option value="">اختر المدينة</option>' + 
    Object.values(cities).map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  citySelect.onchange = () => {
    const selectedCity = citySelect.value;
    const cityKey = Object.keys(cities).find(key => cities[key].name === selectedCity);
    if (cityKey) {
      const districts = cities[cityKey].districts;
      document.getElementById('filterDistrict').innerHTML = '<option value="">اختر المنطقة</option>' +
        districts.map(d => `<option value="${d}">${d}</option>`).join('');
    }
  };
}

window.filterSuppliers = async function() {
  const city = document.getElementById('filterCity').value;
  const district = document.getElementById('filterDistrict').value;
  const minPrice = document.getElementById('filterMinPrice').value;
  const maxPrice = document.getElementById('filterMaxPrice').value;
  const sortBy = document.getElementById('filterSort').value;
  if (!city || !district) {
    alert('الرجاء اختيار المدينة والمنطقة');
    return;
  }
  const response = await fetch('/api/consumer/filter-suppliers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ city, district, minPrice, maxPrice, sortBy })
  });
  const suppliers = await response.json();
  displaySuppliers(suppliers);
};

function displaySuppliers(suppliers) {
  const container = document.getElementById('suppliersList');
  if (suppliers.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-400 col-span-2">لا يوجد موردون متاحون</p>';
    return;
  }
  container.innerHTML = suppliers.map(s => `
    <div class="supplier-card p-4 rounded-lg cursor-pointer" data-supplier='${JSON.stringify(s)}'>
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <div class="flex items-center gap-2">
            ${s.tankImage ? `<img src="${s.tankImage}" class="w-12 h-12 object-cover rounded-full">` : ''}
            <div>
              <p class="font-bold text-lg">${s.user?.name || 'مورد'}</p>
              <p class="text-sm text-gray-400">رقم اللوحة: ${s.plateNumber || 'غير متوفر'}</p>
            </div>
          </div>
          <p class="text-blue-400 font-bold mt-1">${s.pricePerBarrel} $/برميل</p>
          <div class="flex items-center mt-1">
            <span class="text-yellow-400 ml-1">★</span>
            <span>${s.avgRating.toFixed(1)} (${s.ratingCount})</span>
          </div>
          <p class="text-sm text-gray-400 mt-2">الحد الأدنى: ${s.minimumOrder} - الأقصى: ${s.maximumOrder}</p>
        </div>
        <button onclick="showOrderModal('${s.user._id}', ${s.minimumOrder}, ${s.maximumOrder}, ${s.pricePerBarrel}); event.stopPropagation();" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition">طلب</button>
      </div>
    </div>
  `).join('');

  // attach click handlers to open supplier detail modal
  document.querySelectorAll('#suppliersList .supplier-card').forEach(el => {
    el.addEventListener('click', () => {
      try {
        const s = JSON.parse(el.getAttribute('data-supplier'));
        showSupplierModal(s);
      } catch (err) { console.error('parse supplier failed', err); }
    });
  });
}

function showSupplierModal(s) {
  const imgHtml = s.tankImage ? `<img src="${s.tankImage}" class="w-full h-48 object-cover rounded">` : '';
  const html = `
    <div class="p-2">
      <h4 class="font-bold text-lg mb-2">${s.user?.name || 'مورد'}</h4>
      ${imgHtml}
      <p class="mt-2"><strong>رقم اللوحة:</strong> ${s.plateNumber || 'غير متوفر'}</p>
      <p class="mt-1"><strong>السعر:</strong> ${s.pricePerBarrel} $/برميل</p>
      <p class="mt-1"><strong>الحد الأدنى:</strong> ${s.minimumOrder} — <strong>الحد الأقصى:</strong> ${s.maximumOrder}</p>
      <p class="mt-1"><strong>التقييم:</strong> ${s.avgRating.toFixed(1)} (${s.ratingCount})</p>
      <div class="mt-2">
        <p class="font-semibold">مناطق الخدمة:</p>
        <ul class="list-disc ml-6 text-sm">
          ${(s.serviceAreas || []).map(a => `<li>${a.city} - ${a.district}: ${a.pricePerBarrel}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  showModal({ title: 'تفاصيل المورد', html, widthClass: 'md:w-1/2', actions: [
    { label: 'اطلب من هذا المورد', className: 'bg-blue-600 text-white', onClick: (m) => { m.remove(); showOrderModal(s.user._id, s.minimumOrder || 1, s.maximumOrder || 100, s.pricePerBarrel || 0); } },
    { label: 'إغلاق', className: 'bg-gray-200 text-black', onClick: (m) => m.remove() }
  ] });
}

window.showOrderModal = function(supplierId, minQty, maxQty, price) {
  // فتح المودال وملئ القيم الافتراضية
  document.getElementById('orderSupplierId').value = supplierId;
  document.getElementById('orderQuantity').value = minQty;
  document.getElementById('orderDeliveryOption').value = 'now';
  document.getElementById('scheduledRow').classList.add('hidden');
  document.getElementById('orderModal').classList.remove('hidden');
};

async function createOrder(payload) {
  const response = await fetch('/api/consumer/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (response.ok) {
    alert('تم إنشاء الطلب');
    closeOrderModal();
    showTab('orders');
  } else {
    alert(data.message || 'فشل إنشاء الطلب');
  }
}

async function loadConsumerOrders() {
  const res = await fetch('/api/consumer/orders');
  const orders = await res.json();
  const container = document.getElementById('consumerOrdersList');
  if (orders.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-400">لا توجد طلبات بعد</p>';
    return;
  }
  container.innerHTML = orders.map(o => {
    let actionButtons = '';
    if (o.status === 'pending') {
      actionButtons = `<button onclick="cancelOrder('${o._id}')" class="px-3 py-1 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30"><i class="fas fa-times"></i> إلغاء</button>`;
    } else if (o.status === 'delivered') {
      actionButtons = `<button onclick="rateOrder('${o._id}', '${o.supplier?._id}')" class="px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded-lg hover:bg-yellow-600/30"><i class="fas fa-star"></i> تقييم</button>
                       <button onclick="reportOrder('${o._id}', '${o.supplier?._id}')" class="px-3 py-1 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30"><i class="fas fa-flag"></i> بلاغ</button>`;
    } else if (o.status === 'completed') {
      // بعد أن يضع المورد الطلب كـ completed، يسمح للمستهلك بتأكيد الاستلام والانتقال للتقييم أو فتح بلاغ
      actionButtons = `<button onclick="rateOrder('${o._id}', '${o.supplier?._id}')" class="px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded-lg hover:bg-yellow-600/30"><i class="fas fa-check"></i> لقد وصل - اذهب للتقييم</button>
                       <button onclick="reportOrder('${o._id}', '${o.supplier?._id}')" class="px-3 py-1 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30"><i class="fas fa-flag"></i> لم يصل - اذهب للبلاغ</button>`;
    }
    return `
      <div class="glass-card p-4 rounded-lg">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <p class="font-bold">المورد: ${o.supplier?.name || 'غير معروف'}</p>
            <p class="text-sm text-gray-400">الكمية: ${o.quantity} برميل | السعر: ${o.totalPrice} $</p>
            <p class="text-xs">الحالة: <span class="text-${o.status === 'delivered' ? 'green' : o.status === 'cancelled' ? 'red' : o.status === 'enroute' ? 'purple' : 'blue'}-400">${o.status}</span></p>
          </div>
          <div class="flex gap-2">
            ${actionButtons}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // إذا وُجد طلب مكتمل ولم يقم المستهلك بالتقييم بعد، افتح مودال التقييم لأول واحد
  try {
    const pendingRating = orders.find(o => o.status === 'completed' && (!o.rating || !o.rating.createdAt));
    if (pendingRating) {
      rateOrder(pendingRating._id, pendingRating.supplier?._id);
    }
  } catch (err) { console.error('rating check failed', err); }
}

window.cancelOrder = async function(orderId) {
  if (!confirm('هل تريد إلغاء الطلب؟')) return;
  const res = await fetch(`/api/orders/${orderId}/cancel`, { method: 'PUT' });
  if (res.ok) { alert('تم الإلغاء'); loadConsumerOrders(); }
  else { const data = await res.json(); alert(data.message); }
};

window.rateOrder = function(orderId, supplierId) {
  document.getElementById('ratingOrderId').value = orderId;
  document.getElementById('ratingPunctuality').value = 5;
  document.getElementById('ratingQuality').value = 5;
  document.getElementById('ratingClean').value = 5;
  document.getElementById('ratingProf').value = 5;
  document.getElementById('ratingComment').value = '';
  document.getElementById('ratingModal').classList.remove('hidden');
};

async function submitRating(orderId, supplierId, ratings) {
  await fetch('/api/consumer/rate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, ...ratings })
  });
  alert('تم إرسال التقييم');
  loadConsumerOrders();
}

// Modal helpers
function closeOrderModal() {
  document.getElementById('orderModal').classList.add('hidden');
}

function closeRatingModal() {
  document.getElementById('ratingModal').classList.add('hidden');
}

// handle order modal interactions
function setupModalHandlers() {
  const deliverySelect = document.getElementById('orderDeliveryOption');
  const scheduledRow = document.getElementById('scheduledRow');
  if (deliverySelect) {
    deliverySelect.addEventListener('change', (e) => {
      const v = e.target.value;
      if (v === 'scheduled') scheduledRow.classList.remove('hidden'); else scheduledRow.classList.add('hidden');
    });
  }

  const orderForm = document.getElementById('orderForm');
  if (orderForm) {
    orderForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const supplierId = document.getElementById('orderSupplierId').value;
      const quantity = parseInt(document.getElementById('orderQuantity').value, 10);
      const deliveryOption = document.getElementById('orderDeliveryOption').value;
      const scheduledAtInput = document.getElementById('orderScheduledAt').value || null;
      const scheduledAt = scheduledAtInput ? new Date(scheduledAtInput).toISOString() : null;
      if (!supplierId || !quantity) { alert('الرجاء إدخال بيانات صحيحة'); return; }
      createOrder({ supplierId, quantity, deliveryOption, scheduledAt });
    });
  }

  const ratingForm = document.getElementById('ratingForm');
  if (ratingForm) {
    ratingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const orderId = document.getElementById('ratingOrderId').value;
      const punctuality = parseInt(document.getElementById('ratingPunctuality').value, 10);
      const quality = parseInt(document.getElementById('ratingQuality').value, 10);
      const clean = parseInt(document.getElementById('ratingClean').value, 10);
      const prof = parseInt(document.getElementById('ratingProf').value, 10);
      const comment = document.getElementById('ratingComment').value;
      submitRating(orderId, null, {
        punctuality, waterQuality: quality, cleanliness: clean, professionalism: prof, comment
      });
      closeRatingModal();
    });
  }
}

window.reportOrder = function(orderId, supplierId) {
  showTextModal({ title: 'سبب البلاغ', placeholder: 'اكتب سبب البلاغ' }, (reason) => {
    if (!reason) return;
    showTextModal({ title: 'تفاصيل إضافية (اختياري)', placeholder: 'تفاصيل إضافية...', textarea: true, submitText: 'أرسل البلاغ' }, (details) => {
      submitReport(orderId, supplierId, reason, details);
    });
  });
};

async function submitReport(orderId, supplierId, reason, details) {
  await fetch('/api/consumer/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, supplierId, reason, details })
  });
  alert('تم إرسال البلاغ');
}

async function loadNotifications() {
  const res = await fetch('/api/consumer/notifications');
  const notifs = await res.json();
  const container = document.getElementById('notificationsList');
  if (notifs.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-400">لا توجد إشعارات</p>';
    return;
  }
  container.innerHTML = notifs.map(n => `
    <div class="glass-card p-4 rounded-lg ${n.read ? 'opacity-60' : 'border-r-4 border-blue-500'}">
      <p class="font-bold">${n.title}</p>
      <p class="text-sm text-gray-300">${n.message}</p>
      <p class="text-xs text-gray-500 mt-1">${new Date(n.createdAt).toLocaleString()}</p>
    </div>
  `).join('');
}

async function loadProfile() {
  const res = await fetch('/api/consumer/profile');
  const consumer = await res.json();
  consumerData = consumer;
  document.querySelector('#profileForm input[name="name"]').value = consumer.user.name;
  document.querySelector('#profileForm input[name="phone"]').value = consumer.user.phone;
  document.querySelector('#profileForm input[name="email"]').value = consumer.user.email || '';
  document.querySelector('#profileForm input[name="address"]').value = consumer.address;
  document.querySelector('#profileForm input[name="city"]').value = consumer.city;
  document.querySelector('#profileForm input[name="district"]').value = consumer.district;

  if (!map) {
    map = L.map('map').setView([consumer.location.coordinates[1], consumer.location.coordinates[0]], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    marker = L.marker([consumer.location.coordinates[1], consumer.location.coordinates[0]], { draggable: false }).addTo(map);
  } else {
    map.setView([consumer.location.coordinates[1], consumer.location.coordinates[0]], 15);
    marker.setLatLng([consumer.location.coordinates[1], consumer.location.coordinates[0]]);
  }
}

window.enableEdit = function() {
  // make profile fields editable and switch button to submit mode
  const inputs = document.querySelectorAll('#profileForm input');
  inputs.forEach(i => i.removeAttribute('readonly'));
  const btn = document.querySelector('#profileForm button');
  btn.textContent = 'أرسل طلب التعديل';
  btn.onclick = async function() {
    // collect changed fields compared to consumerData
    const changes = [];
    const name = document.querySelector('#profileForm input[name="name"]').value.trim();
    const phone = document.querySelector('#profileForm input[name="phone"]').value.trim();
    const email = document.querySelector('#profileForm input[name="email"]').value.trim();
    const address = document.querySelector('#profileForm input[name="address"]').value.trim();
    const city = document.querySelector('#profileForm input[name="city"]').value.trim();
    const district = document.querySelector('#profileForm input[name="district"]').value.trim();

    if (consumerData && (name !== (consumerData.user?.name || ''))) changes.push({ field: 'user.name', newValue: name });
    if (consumerData && (phone !== (consumerData.user?.phone || ''))) changes.push({ field: 'user.phone', newValue: phone });
    if (consumerData && (email !== (consumerData.user?.email || ''))) changes.push({ field: 'user.email', newValue: email });
    if (consumerData && (address !== (consumerData.address || ''))) changes.push({ field: 'consumer.address', newValue: address });
    if (consumerData && (city !== (consumerData.city || ''))) changes.push({ field: 'consumer.city', newValue: city });
    if (consumerData && (district !== (consumerData.district || ''))) changes.push({ field: 'consumer.district', newValue: district });

    if (changes.length === 0) { alert('لا تغييرات'); return; }

    // submit all change requests sequentially
    for (const ch of changes) {
      await fetch('/api/consumer/edit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ch)
      });
    }

    alert('تم إرسال طلب(طلبات) التعديل للمراجعة');
    // revert fields to readonly and refresh profile
    inputs.forEach(i => i.setAttribute('readonly', true));
    btn.textContent = 'طلب تعديل';
    btn.onclick = enableEdit;
    loadProfile();
  };
};

async function loadMyRatings() {
  try {
    const res = await fetch('/api/consumer/ratings');
    const ratings = await res.json();
    const container = document.getElementById('ratingsList');
    if (!ratings || ratings.length === 0) {
      container.innerHTML = '<p class="text-center text-gray-400">لا توجد تقييمات بعد</p>';
      return;
    }
    container.innerHTML = ratings.map(r => `
      <div class="glass-card p-3 rounded-lg">
        <p class="font-bold">مورد: ${r.supplier?.name || 'غير معروف'}</p>
        <p class="text-sm text-gray-400">الطلب: #${r.order?._id?.slice(-6) || ''} — ${r.punctuality}/5 التزام | ${r.waterQuality}/5 جودة</p>
        <p class="text-sm text-gray-400">نظافة: ${r.cleanliness} — احترافية: ${r.professionalism}</p>
        <p class="text-xs text-gray-300 mt-2">${r.comment || ''}</p>
        <p class="text-xs text-gray-500 mt-1">${new Date(r.createdAt).toLocaleString()}</p>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load ratings', err);
    document.getElementById('ratingsList').innerHTML = '<p class="text-center text-gray-400">حدث خطأ</p>';
  }
}

window.onload = async function() {
  const res = await fetch('/api/auth/me');
  if (res.ok) {
    const user = await res.json();
    currentUser = user;
    document.getElementById('consumerName').textContent = user.name;
    initSocket();
    showTab('dashboard');
    updateNotificationBadge();
    // attach modal handlers after DOM is ready
    try { setupModalHandlers(); } catch (err) { console.error('setupModalHandlers failed', err); }
  } else {
    window.location.href = '/login.html';
  }
};