/* Margulis Business Club — логика сайта.
   Настройки ссылок — в объекте SITE ниже. */
(function () {
  'use strict';

  var SITE = {
    jera: 'https://jera.club',
    whatsapp: '972533335040',
    telegram: 'https://t.me/margulis_club'
  };

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"></path><path d="M8 7h9v9"></path></svg>';

  document.documentElement.classList.add('js');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function parts(date) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function dateLong(date) {
    var p = parts(date);
    return p ? p.d + ' ' + MONTHS[p.m - 1] + ' ' + p.y : '';
  }
  function dateDay(date) {
    var p = parts(date);
    return p ? p.d + ' ' + MONTHS[p.m - 1] : '';
  }
  function dateShort(date) {
    var p = parts(date);
    return p ? p.d + ' ' + MONTHS_SHORT[p.m - 1] : '';
  }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function money(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₪';
  }
  function priceLabel(ev) {
    var prices = (ev.tickets || []).map(function (t) { return Number(t.price); }).filter(function (n) { return !isNaN(n); });
    if (!prices.length) return '';
    var min = Math.min.apply(null, prices);
    if (min === 0 && prices.length === 1) return 'Бесплатно';
    return (prices.length > 1 ? 'от ' : '') + money(min);
  }
  function upcoming() {
    var today = todayIso();
    return (window.EVENTS || [])
      .filter(function (e) { return e && e.id && e.date >= today; })
      .sort(function (a, b) { return (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')); });
  }
  function eventUrl(ev) { return 'event.html?id=' + encodeURIComponent(ev.id); }
  function buyUrl(ev) {
    if (ev.ticketUrl) return ev.ticketUrl;
    var text = 'Здравствуйте! Хочу купить билет на «' + ev.title + '», ' + dateLong(ev.date) + '.';
    return 'https://wa.me/' + SITE.whatsapp + '?text=' + encodeURIComponent(text);
  }
  function meta(ev, short) {
    return [short ? dateShort(ev.date) : dateDay(ev.date), ev.time, ev.city].filter(Boolean).join(' · ');
  }
  function cover(ev) {
    return ev.cover ? '<img src="' + esc(ev.cover) + '" alt="" loading="lazy" onerror="this.remove()">' : '';
  }
  function pill(ev) {
    if (ev.status === 'soon') return '<span class="pill pill--ghost">Скоро в продаже</span>';
    if (ev.status === 'soldout') return '<span class="pill pill--ghost">Билеты закончились</span>';
    return '<span class="pill">Купить билет</span>';
  }

  /* Главная: афиша и плитка ближайшего события */
  function renderHome() {
    var list = document.getElementById('events-list');
    var next = document.getElementById('next-event');
    var events = upcoming();

    if (list) {
      if (!events.length) {
        list.innerHTML = '<div class="empty"><h3 class="h3">Новые события скоро появятся</h3>' +
          '<p class="muted">Подпишитесь на Telegram клуба, чтобы не пропустить анонс.</p>' +
          '<a class="btn btn--light" href="' + SITE.telegram + '" target="_blank" rel="noopener">Подписаться в Telegram</a></div>';
      } else {
        list.innerHTML = '<div class="cards">' + events.map(function (ev) {
          return '<a class="card reveal" href="' + eventUrl(ev) + '">' +
            '<div class="card__cover">' + cover(ev) + (ev.demo ? '<span class="badge">Пример</span>' : '') + '</div>' +
            '<div class="card__body"><span class="eyebrow">' + esc(meta(ev, true)) + '</span>' +
            '<span class="card__title">' + esc(ev.title) + '</span>' +
            '<div class="card__foot"><span class="card__price">' + esc(priceLabel(ev)) + '</span>' + pill(ev) + '</div></div></a>';
        }).join('') + '</div>';
      }
    }
    if (next) {
      var ev = events[0];
      if (ev) {
        next.href = eventUrl(ev);
        next.querySelector('.next__title').textContent = ev.title;
        next.querySelector('.next__meta').textContent = [dateDay(ev.date), ev.city, priceLabel(ev)].filter(Boolean).join(' · ');
      } else {
        next.href = SITE.telegram;
        next.querySelector('.next__label-text').textContent = 'Анонсы событий';
        next.querySelector('.next__title').textContent = 'Следите в Telegram';
        next.querySelector('.next__meta').textContent = 'Новые события скоро появятся';
      }
    }
  }

  /* Страница события */
  function renderEvent() {
    var root = document.getElementById('event-root');
    if (!root) return;
    var id = new URLSearchParams(location.search).get('id');
    var ev = (window.EVENTS || []).filter(function (e) { return e && e.id === id; })[0];

    if (!ev) {
      root.innerHTML = '<div class="page wrap"><h1>Событие не найдено</h1>' +
        '<p class="muted">Возможно, оно уже прошло или ссылка устарела.</p>' +
        '<div><a class="btn btn--light" href="index.html#events">Афиша событий</a></div></div>';
      return;
    }
    document.title = ev.title + ' — Margulis Business Club';

    var past = ev.date < todayIso();
    var program = (ev.program || []).filter(function (r) { return r && r.text; });
    var tickets = ev.tickets || [];
    var action;
    if (past) {
      action = '<p class="muted">Событие завершено.</p><a class="btn btn--light" href="index.html#events">Афиша событий</a>';
    } else if (ev.status === 'soon') {
      action = '<p class="muted">Продажа билетов скоро откроется. Анонс — в Telegram клуба.</p>' +
        '<a class="btn btn--light" href="' + SITE.telegram + '" target="_blank" rel="noopener">Подписаться в Telegram</a>';
    } else if (ev.status === 'soldout') {
      action = '<p class="muted">Все билеты проданы. Напишите нам — сообщим, если место освободится.</p>' +
        '<a class="btn btn--ghost" href="https://wa.me/' + SITE.whatsapp + '" target="_blank" rel="noopener">Написать в WhatsApp</a>';
    } else {
      action = '<a class="btn btn--accent btn--lg" href="' + esc(buyUrl(ev)) + '" target="_blank" rel="noopener">Купить билет ' + ARROW + '</a>' +
        '<p class="small" style="text-align:center">' + (ev.ticketUrl ? 'Оплата откроется в новой вкладке.' : 'Откроется WhatsApp клуба — оформим билет в переписке.') + '</p>';
    }

    root.innerHTML =
      '<div class="event wrap">' +
        '<div class="event__main">' +
          '<div><span class="eyebrow eyebrow--accent">' + esc([dateLong(ev.date), ev.time, ev.city].filter(Boolean).join(' · ')) + (ev.demo ? ' · пример' : '') + '</span>' +
          '<h1 class="rise">' + esc(ev.title) + '</h1></div>' +
          '<div class="event__cover">' + cover(ev) + '</div>' +
          ((ev.description || ev.short) ? '<p class="event__text">' + esc(ev.description || ev.short) + '</p>' : '') +
          (program.length ? '<div><div class="eyebrow" style="padding-bottom:16px">Программа</div>' + program.map(function (r) {
            return '<div class="program__row"><span class="program__time">' + esc(r.time) + '</span><span class="program__text">' + esc(r.text) + '</span></div>';
          }).join('') + '</div>' : '') +
          '<div class="facts">' +
            '<div class="fact"><span class="eyebrow">Когда</span><b>' + esc([dateLong(ev.date), ev.time].filter(Boolean).join(', ')) + '</b></div>' +
            '<div class="fact"><span class="eyebrow">Где</span><b>' + esc([ev.city, ev.venue].filter(Boolean).join(', ') || 'Место уточняется') + '</b></div>' +
          '</div>' +
        '</div>' +
        '<aside class="buy rise d1">' +
          '<div class="buy__head"><h2>Билеты</h2></div>' +
          tickets.map(function (t) {
            return '<div class="ticket"><div><div class="ticket__name">' + esc(t.name) + '</div>' +
              (t.note ? '<div class="ticket__note">' + esc(t.note) + '</div>' : '') + '</div>' +
              '<div class="ticket__price">' + (Number(t.price) === 0 ? 'Бесплатно' : esc(money(t.price))) + '</div></div>';
          }).join('') +
          action +
        '</aside>' +
      '</div>';
  }

  /* Появление блоков при прокрутке */
  function reveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  function logo() {
    document.querySelectorAll('.logo__img').forEach(function (img) {
      function swap() { img.closest('.logo').classList.add('logo--image'); img.hidden = false; var t = img.parentNode.querySelector('.logo__mark'); if (t) t.hidden = true; }
      img.hidden = true;
      if (img.complete && img.naturalWidth) swap();
      img.addEventListener('load', swap);
    });
  }

  renderHome();
  renderEvent();
  fetch('/api/events').then(function (r) { return r.json(); }).then(function (data) {
    if (Array.isArray(data.events)) { window.EVENTS = data.events; renderHome(); renderEvent(); }
  }).catch(function () {});
  logo();
  reveal();
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
