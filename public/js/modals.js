// Enhanced generic modal renderer
function showModal({ id = null, title = '', html = '', widthClass = 'md:w-1/2', closable = true, actions = [] } = {}) {
  const existingId = id || '__modal_' + Math.random().toString(36).slice(2, 9);
  const existing = document.getElementById(existingId);
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.id = existingId;
  wrapper.className = 'fixed inset-0 z-50 flex items-center justify-center';
  wrapper.innerHTML = `
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <div class="relative ${widthClass} mx-4">
      <div class="bg-white text-black rounded-lg overflow-hidden shadow-lg">
        <div class="flex items-center justify-between p-4 border-b">
          <h3 class="font-bold text-lg">${title}</h3>
          ${closable ? '<button id="' + existingId + '_close" class="px-2 py-1 rounded bg-gray-200">إغلاق</button>' : ''}
        </div>
        <div class="p-4 max-h-[70vh] overflow-y-auto">${html}</div>
        <div class="p-3 border-t flex gap-2 justify-end">
          ${actions.map((a, i) => `<button data-action-index="${i}" class="px-4 py-2 rounded ${a.className || 'bg-blue-600 text-white'}">${a.label}</button>`).join('')}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);

  if (closable) {
    const closeBtn = document.getElementById(existingId + '_close');
    if (closeBtn) closeBtn.addEventListener('click', () => wrapper.remove());
  }

  // wire actions
  actions.forEach((act, idx) => {
    const btn = wrapper.querySelector(`[data-action-index="${idx}"]`);
    if (!btn) return;
    btn.addEventListener('click', (ev) => {
      try {
        act.onClick && act.onClick(wrapper, ev);
      } catch (err) {
        console.error('modal action failed', err);
      }
    });
  });

  return wrapper;
}

function showTextModal(opts, callback) {
  const { title = 'ادخل', placeholder = '', textarea = false, submitText = 'إرسال' } = opts || {};
  const inputHtml = textarea ? `<textarea id="__modal_input" rows="4" class="w-full p-2 border rounded" placeholder="${placeholder}"></textarea>`
                               : `<input id="__modal_input" class="w-full p-2 border rounded" placeholder="${placeholder}">`;
  const modal = showModal({
    title,
    html: inputHtml,
    actions: [
      { label: 'إلغاء', className: 'bg-gray-200 text-black', onClick: (m) => m.remove() },
      { label: submitText, className: 'bg-blue-600 text-white', onClick: (m) => { const val = document.getElementById('__modal_input').value; m.remove(); callback(val); } }
    ]
  });
  return modal;
}

function showConfirmModal({ title = 'تأكيد', message = '', confirmText = 'نعم', cancelText = 'لا' } = {}, callback) {
  const modal = showModal({
    title,
    html: `<p class=\"mb-2\">${message}</p>`,
    actions: [
      { label: cancelText, className: 'bg-gray-200 text-black', onClick: (m) => { m.remove(); callback(false); } },
      { label: confirmText, className: 'bg-blue-600 text-white', onClick: (m) => { m.remove(); callback(true); } }
    ]
  });
  return modal;
}

// expose to global so existing code can call
window.showModal = showModal;
window.showTextModal = showTextModal;
window.showConfirmModal = showConfirmModal;
