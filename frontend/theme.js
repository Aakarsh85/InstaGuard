// ============================================================
// THEME PERSISTENCE — paste at the very top of script.js
// ============================================================

// 1. Apply saved theme immediately (runs before DOM is ready — prevents flash)
(function () {
  var saved = localStorage.getItem('ig-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

// 2. Set a specific theme and save it
function setTheme(mode) {
  if (mode === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('ig-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('ig-theme', 'light');
  }
}

// 3. Toggle between light and dark
function toggleTheme() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  setTheme(isDark ? 'light' : 'dark');
}

// 4. Wire a toggle button by its ID (safe to call multiple times)
function initThemeToggle(btnId) {
  function attach() {
    var btn = document.getElementById(btnId);
    if (!btn || btn._themeInitialized) return;
    btn._themeInitialized = true;
    btn.addEventListener('click', toggleTheme);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
}

// 5. Auto-wire the toggle buttons used across all pages on DOM ready
document.addEventListener('DOMContentLoaded', function () {
  initThemeToggle('themeToggle');
  initThemeToggle('navThemeToggle');
  if (typeof initFormListeners === 'function') initFormListeners();
//   initFormListeners();
  // landing.html + methodology.html — scroll nav + animations
  var nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    });
  }

  // Landing page — metric bar scroll animation
  if (document.querySelector('.metrics-cards')) {
    var metricObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.mc-fill').forEach(function (bar) {
            bar.style.transition = 'width 1.1s cubic-bezier(0.16,1,0.3,1)';
          });
        }
      });
    }, { threshold: 0.3 });
    document.querySelectorAll('.metrics-cards').forEach(function (el) {
      metricObserver.observe(el);
    });
  }

  // Methodology page — big metric bars + dataset bars scroll animation
  if (document.querySelector('.metrics-big-grid, .dataset-card')) {
    var mbgObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.querySelectorAll('.mbg-fill, .dsb-fill, .mc-fill').forEach(function (bar) {
            var w = bar.dataset.w;
            if (w) setTimeout(function () { bar.style.width = w + '%'; }, 100);
          });
        }
      });
    }, { threshold: 0.2 });
    document.querySelectorAll('.metrics-big-grid, .dataset-card').forEach(function (el) {
      mbgObserver.observe(el);
    });
  }

  // Landing page — stagger card animations
  document.querySelectorAll('.step-card, .feature-card, .metric-card').forEach(function (el, i) {
    el.style.animationDelay = (i * 0.08) + 's';
  });

  // Methodology page — stagger pipeline steps
  document.querySelectorAll('.pipeline-step').forEach(function (el, i) {
    el.style.animationDelay = (i * 0.08) + 's';
  });
});
