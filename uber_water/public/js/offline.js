// تخزين البيانات الأساسية في IndexedDB باستخدام localForage (مكتبة صغيرة)
// يمكن استخدام localStorage كبديل بسيط.

const db = localforage.createInstance({ name: 'uberwater' });

// حفظ البيانات عند الاتصال
async function cacheData(key, data) {
  await db.setItem(key, data);
}

// استرجاع البيانات من الكاش
async function getCachedData(key) {
  return await db.getItem(key);
}

// مراقبة حالة الاتصال
window.addEventListener('online', syncOfflineActions);
window.addEventListener('offline', () => {
  console.log('أصبحت غير متصل');
  // يمكن عرض رسالة للمستخدم
});

// قائمة بالإجراءات التي تمت أثناء عدم الاتصال
let offlineActions = [];

// إضافة إجراء (مثل إنشاء طلب) أثناء عدم الاتصال
function addOfflineAction(action) {
  offlineActions.push({ ...action, timestamp: Date.now() });
  localStorage.setItem('offlineActions', JSON.stringify(offlineActions));
}

// مزامنة الإجراءات عند العودة للاتصال
async function syncOfflineActions() {
  const actions = JSON.parse(localStorage.getItem('offlineActions') || '[]');
  if (actions.length === 0) return;

  for (const action of actions) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: JSON.stringify(action.data)
      });
      if (response.ok) {
        // إزالة الإجراء من القائمة
        offlineActions = offlineActions.filter(a => a.timestamp !== action.timestamp);
      }
    } catch (err) {
      console.error('فشل مزامنة الإجراء', action);
    }
  }
  localStorage.setItem('offlineActions', JSON.stringify(offlineActions));
}

// مثال: تخزين طلب جديد
async function createOrderOffline(orderData) {
  addOfflineAction({
    url: '/api/consumer/order',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: orderData
  });
  // عرض رسالة للمستخدم بأن الطلب سيتم إرساله لاحقاً
  alert('تم حفظ الطلب محلياً وسيتم إرساله تلقائياً عند استعادة الاتصال.');
}