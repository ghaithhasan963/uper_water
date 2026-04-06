function initResponsive() {
  // Toggle sidebar for mobile
  document.querySelectorAll('[data-sidebar-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sidebar = document.getElementById('appSidebar');
      if (!sidebar) return;
      sidebar.classList.toggle('hidden');
      sidebar.classList.toggle('open');
      const isOpen = sidebar.classList.contains('open');
      document.body.style.overflow = isOpen ? 'hidden' : '';
      document.body.classList.toggle('sidebar-open', isOpen);
    });
  });

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('appSidebar');
    if (!sidebar) return;
    if (!sidebar.classList.contains('open')) return;
    const target = e.target;
    if (!sidebar.contains(target) && !target.closest('[data-sidebar-toggle]')) {
      sidebar.classList.add('hidden');
      sidebar.classList.remove('open');
      document.body.style.overflow = '';
      document.body.classList.remove('sidebar-open');
    }
  });
}

// initialize after DOM
window.addEventListener('DOMContentLoaded', () => {
  try { initResponsive(); } catch (err) { console.error('initResponsive failed', err); }
});
