(function () {
  'use strict';
  if (window.showy_noads) return;
  window.showy_noads = true;

  var BANNER = '.showy-pro-entry-banner';
  var PROMO_MODAL = '.showy-marketing-card, .showy-marketing-expired';
  var timer = null;

  function addCss() {
    if (document.getElementById('showy-noads-css')) return;
    var s = document.createElement('style');
    s.id = 'showy-noads-css';
    s.innerHTML = BANNER + '{display:none!important}';
    document.head.appendChild(s);
  }

  function modalOf(node) {
    while (node && node !== document.body) {
      if (node.classList && node.classList.contains('modal')) return node;
      node = node.parentNode;
    }
    return null;
  }

  function sweep() {
    var i, list, modal, found = false;

    list = document.querySelectorAll(BANNER);
    for (i = 0; i < list.length; i++) {
      if (list[i].parentNode) list[i].parentNode.removeChild(list[i]);
    }

    list = document.querySelectorAll(PROMO_MODAL);
    for (i = 0; i < list.length; i++) {
      modal = modalOf(list[i]);
      if (modal) {
        modal.style.display = 'none';
        found = true;
      }
    }
    if (found) {
      try { Lampa.Modal.close(); } catch (e) {}
    }
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(function () {
      timer = null;
      sweep();
    }, 0);
  }

  function init() {
    addCss();
    sweep();
    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (!window.Lampa) return;
  if (window.appready) init();
  else Lampa.Listener.follow('app', function (e) {
    if (e.type === 'ready') init();
  });
})();
