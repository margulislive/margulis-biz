(function () {
  'use strict';
  function selector(el) {
    var parts = [];
    while (el && el.tagName !== 'BODY') {
      var n = 1, p = el;
      while ((p = p.previousElementSibling)) if (p.tagName === el.tagName) n++;
      parts.unshift(el.tagName.toLowerCase() + ':nth-of-type(' + n + ')'); el = el.parentElement;
    }
    return 'body>' + parts.join('>');
  }
  function fields(doc) {
    var result = [];
    doc.querySelectorAll('body *').forEach(function (el) {
      if (el.closest('script,style,noscript,svg,#events-list,#next-event,#event-root') || el.id === 'year') return;
      var tag = el.tagName.toLowerCase(), path = selector(el);
      if (tag === 'img') result.push({key:path+'|src', value:el.getAttribute('src') || '', type:'image', element:el});
      if (tag === 'a' && el.getAttribute('href')) result.push({key:path+'|href', value:el.getAttribute('href'), type:'link', element:el});
      Array.from(el.childNodes).forEach(function (node, i) {
        if (node.nodeType === 3 && node.textContent.trim()) result.push({key:path+'|text|'+i, value:node.textContent.trim(), type:'text', element:el, index:i});
      });
    });
    return result;
  }
  function safeUrl(value, image) {
    if (!value) return '';
    try { var u = new URL(value, location.origin); if (image ? !/^https?:$/.test(u.protocol) : !/^(https?:|mailto:|tel:)$/.test(u.protocol)) return null; return value; } catch (_) { return null; }
  }
  function apply(doc, values) {
    fields(doc).forEach(function (f) {
      if (!Object.prototype.hasOwnProperty.call(values, f.key) || typeof values[f.key] !== 'string') return;
      var value = values[f.key];
      if (f.type === 'text') { var node = f.element.childNodes[f.index]; if (node && node.nodeType === 3) node.textContent = value; }
      else { var url = safeUrl(value, f.type === 'image'); if (url !== null) { f.element.setAttribute(f.type === 'image' ? 'src' : 'href', url); if (f.type === 'image') f.element.style.display = ''; } }
    });
  }
  window.SiteContent = {fields:fields, apply:apply};
  if (!document.body.hasAttribute('data-admin')) {
    var page = location.pathname.split('/').pop() || 'index.html';
    fetch('/api/content').then(function (r) { return r.json(); }).then(function (data) {
      apply(document, data[page] || {});
      if (page === 'index.html' && Array.isArray(data.heroPhotos) && data.heroPhotos.length) {
        var photos = data.heroPhotos.filter(function (url) { return typeof url === 'string' && safeUrl(url, true) !== null; });
        var img = document.querySelector('.bento__photo img'), n = 0;
        if (img && photos.length) { img.src = photos[0]; if (photos.length > 1) setInterval(function () { n = (n + 1) % photos.length; img.src = photos[n]; }, 6000); }
      }
    }).catch(function () {});
  }
})();
