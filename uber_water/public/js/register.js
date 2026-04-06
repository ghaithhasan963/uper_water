// بيانات المدن
let citiesData = {};
let map, marker;

// عناصر DOM
const roleRadios = document.querySelectorAll('input[name="role"]');
const consumerFields = document.getElementById('consumerFields');
const supplierFields = document.getElementById('supplierFields');
const citySelect = document.getElementById('city');
const districtSelect = document.getElementById('district');
const locationInput = document.getElementById('location');

// تهيئة الخريطة
if (document.getElementById('map')) {
  map = L.map('map').setView([33.8938, 35.5018], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  marker = L.marker([33.8938, 35.5018], { draggable: true }).addTo(map);
  marker.on('dragend', function(e) {
    const pos = e.target.getLatLng();
    locationInput.value = JSON.stringify([pos.lng, pos.lat]);
  });
  locationInput.value = JSON.stringify([35.5018, 33.8938]);
}

// جلب المدن وتعبئة القوائم
async function loadCities() {
  const res = await fetch('/api/auth/cities');
  citiesData = await res.json();
  
  // تعبئة قائمة المدن للمستهلك
  citySelect.innerHTML = '<option value="">اختر المدينة</option>' + 
    Object.values(citiesData).map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  
  // عند تغيير المدينة، تحديث قائمة المناطق
  citySelect.addEventListener('change', function() {
    const cityName = this.value;
    const cityKey = Object.keys(citiesData).find(key => citiesData[key].name === cityName);
    if (cityKey && citiesData[cityKey].districts) {
      districtSelect.innerHTML = '<option value="">اختر المنطقة</option>' +
        citiesData[cityKey].districts.map(d => `<option value="${d}">${d}</option>`).join('');
    } else {
      districtSelect.innerHTML = '<option value="">اختر المنطقة</option>';
    }
  });
  
  // تعبئة قوائم المدن في مناطق الخدمة للمورد
  document.querySelectorAll('.city-select').forEach(select => {
    select.innerHTML = '<option value="">اختر المدينة</option>' + 
      Object.values(citiesData).map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    
    select.addEventListener('change', function() {
      const cityName = this.value;
      const cityKey = Object.keys(citiesData).find(key => citiesData[key].name === cityName);
      const districtSelect = this.closest('.flex').querySelector('.district-select');
      if (cityKey && citiesData[cityKey].districts) {
        districtSelect.innerHTML = '<option value="">اختر المنطقة</option>' +
          citiesData[cityKey].districts.map(d => `<option value="${d}">${d}</option>`).join('');
      } else {
        districtSelect.innerHTML = '<option value="">اختر المنطقة</option>';
      }
    });
  });
}

// تبديل الحقول حسب الدور
roleRadios.forEach(radio => {
  radio.addEventListener('change', function() {
    if (this.value === 'consumer') {
      consumerFields.style.display = 'block';
      supplierFields.style.display = 'none';
    } else {
      consumerFields.style.display = 'none';
      supplierFields.style.display = 'block';
    }
  });
});

// إضافة منطقة خدمة جديدة
window.addServiceArea = function() {
  const container = document.getElementById('serviceAreasContainer');
  const newRow = document.createElement('div');
  newRow.className = 'flex gap-2 items-center';
  newRow.innerHTML = `
    <select class="city-select p-2 bg-white/10 border border-white/20 rounded text-white flex-1">
      <option value="">اختر المدينة</option>
    </select>
    <select class="district-select p-2 bg-white/10 border border-white/20 rounded text-white flex-1">
      <option value="">اختر المنطقة</option>
    </select>
    <input type="number" placeholder="السعر" class="price-input p-2 bg-white/10 border border-white/20 rounded text-white w-24">
    <button type="button" onclick="this.parentElement.remove()" class="bg-red-600 text-white p-2 rounded hover:bg-red-700"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(newRow);
  
  // تعبئة قوائم المدينة في الصف الجديد
  if (citiesData) {
    const citySelect = newRow.querySelector('.city-select');
    citySelect.innerHTML = '<option value="">اختر المدينة</option>' + 
      Object.values(citiesData).map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    citySelect.addEventListener('change', function() {
      const cityName = this.value;
      const cityKey = Object.keys(citiesData).find(key => citiesData[key].name === cityName);
      const districtSelect = this.closest('.flex').querySelector('.district-select');
      if (cityKey && citiesData[cityKey].districts) {
        districtSelect.innerHTML = '<option value="">اختر المنطقة</option>' +
          citiesData[cityKey].districts.map(d => `<option value="${d}">${d}</option>`).join('');
      } else {
        districtSelect.innerHTML = '<option value="">اختر المنطقة</option>';
      }
    });
  }
};

// إرسال النموذج
document.getElementById('registerForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const formData = new FormData(this);

  if (document.querySelector('input[name="role"]:checked').value === 'supplier') {
    const rows = document.querySelectorAll('#serviceAreasContainer > div');
    const areas = [];
    rows.forEach(row => {
      const city = row.querySelector('.city-select')?.value;
      const district = row.querySelector('.district-select')?.value;
      const price = row.querySelector('.price-input')?.value;
      if (city && district && price) {
        areas.push({ city, district, pricePerBarrel: parseFloat(price) });
      }
    });
    document.getElementById('serviceAreas').value = JSON.stringify(areas);
  }

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (response.ok) {
      alert('تم التسجيل بنجاح، في انتظار مراجعة المشرف');
      window.location.href = '/login.html';
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('حدث خطأ في الاتصال');
  }
});

// عند تحميل الصفحة
loadCities();