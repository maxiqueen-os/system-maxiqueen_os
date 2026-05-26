
/* =======================
   THEME TOGGLE
======================= */
function toggleTheme(){
  const root = document.documentElement;
  const current = root.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('mq-theme', next);
}
(function(){
  const saved = localStorage.getItem('mq-theme');
  if(saved) document.documentElement.setAttribute('data-theme', saved);
})();
