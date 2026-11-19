'use strict';

// Контакты записи. Номер WhatsApp в международном формате без «+».
const TELEGRAM_USER = 'aliabuturabofficial';
const WHATSAPP_NUMBER = '79285259009'; // +7 928 525-90-09

const GREETING = 'السلام عليكم ورحمة الله وبركاته.';

const hasWhatsApp = () => /^\d{10,15}$/.test(WHATSAPP_NUMBER);

function enrollMessage(course, format) {
  if (!course) return `${GREETING} Хочу записаться на курс.`;
  return `${GREETING} Хочу записаться на курс «${course}»${format ? `, ${format}` : ''}.`;
}

function telegramUrl(text) {
  return `https://t.me/${TELEGRAM_USER}?text=${encodeURIComponent(text)}`;
}

function whatsappUrl(text) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function setupEnrollLinks() {
  document.querySelectorAll('a[data-course]').forEach((link) => {
    link.href = telegramUrl(enrollMessage(link.dataset.course));
  });

  if (!hasWhatsApp()) return;

  document.querySelectorAll('a[data-wa]').forEach((link) => {
    link.href = whatsappUrl(enrollMessage(link.dataset.wa));
    link.hidden = false;
  });
  document.querySelectorAll('[data-wa-item]').forEach((item) => { item.hidden = false; });
  document.querySelectorAll('[data-wa-label]').forEach((label) => {
    label.textContent = `+${WHATSAPP_NUMBER}`;
  });
}

// Шаг «Выберите курс»: выбор сразу виден в превью сообщения и уходит в ссылки.
function setupComposer() {
  const courseOut = document.querySelector('[data-msg-course]');
  const formatOut = document.querySelector('[data-msg-format]');
  const tgLink = document.querySelector('a[data-compose]');
  const waLink = document.querySelector('.enroll a[data-wa]');
  if (!courseOut || !formatOut || !tgLink) return;

  const picked = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value ?? '';

  const update = () => {
    const course = picked('course');
    const format = picked('format');
    const text = enrollMessage(course, format);
    courseOut.textContent = course;
    formatOut.textContent = format;
    tgLink.href = telegramUrl(text);
    if (waLink && hasWhatsApp()) waLink.href = whatsappUrl(text);
  };

  document.querySelectorAll('input[name="course"], input[name="format"]').forEach((input) => {
    input.addEventListener('change', update);
  });
  update();
}

function setupNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  const header = document.querySelector('.site-header');
  if (!toggle || !nav) return;

  // открытое меню всегда на ночной шапке, даже над первым экраном
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    header?.classList.toggle('is-menu', open);
  };

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
}

// Шапка прозрачная, пока виден первый экран (класс on-hero на <html> ставит boot.js), дальше зелёная.
const setOnHero = (on) => document.documentElement.classList.toggle('on-hero', on);

// Hero прокручивается под шапкой: она темнеет, как только логотип первого экрана начинает уходить
// под неё, и название переходит в шапку, а текст hero не бежит под прозрачными ссылками.
function watchHero() {
  const mark = document.querySelector('.hero-mark');
  const header = document.querySelector('.site-header');
  if (!mark || !header || !('IntersectionObserver' in window)) {
    setOnHero(false);
    return () => {};
  }
  const observer = new IntersectionObserver(([entry]) => setOnHero(entry.intersectionRatio > 0.98), {
    rootMargin: `-${header.offsetHeight}px 0px 0px 0px`,
    threshold: [0, 0.98, 1],
  });
  observer.observe(mark);
  return () => observer.disconnect();
}

// Красная ручка учителя обводит букву в аяте. Единственная анимация на странице:
// один раз, когда лист дошёл до экрана. При «уменьшить движение» обводка уже стоит.
function setupPen() {
  const sheet = document.querySelector('[data-pen]');
  const target = sheet?.querySelector('[data-pen-target]');
  const pen = sheet?.querySelector('.pen');
  if (!target || !pen) return;

  const place = () => {
    const box = sheet.getBoundingClientRect();
    const letter = target.getBoundingClientRect();
    const w = letter.width * 2.3;
    const h = letter.height * 1.05;
    pen.style.left = `${letter.left - box.left + letter.width / 2 - w / 2}px`;
    pen.style.top = `${letter.top - box.top + letter.height * 0.47 - h / 2}px`;
    pen.style.width = `${w}px`;
    pen.style.height = `${h}px`;
  };

  const animate = 'IntersectionObserver' in window
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  place();
  pen.classList.add('is-placed');
  window.addEventListener('resize', place);
  document.fonts?.ready.then(place);

  if (!animate) return;

  pen.classList.add('is-waiting');
  const observer = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();
    pen.classList.add('is-drawing');
    requestAnimationFrame(() => pen.classList.remove('is-waiting'));
  }, { threshold: 0.6 });
  observer.observe(sheet);
}

// Нажатие на кнопку: короткая вибрация, где телефон её поддерживает.
function setupButtonFeedback() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn')) navigator.vibrate?.(12);
  });
}

// ---------- Первый экран: логотип на мраморе ----------
// GSAP (vendor/gsap). При загрузке логотип проступает из мрамора, за ним строка о занятиях и кнопка записи.
// При прокрутке первый экран уходит медленнее страницы, логотип чуть уменьшается и тает.
// Без GSAP, без JS и при «уменьшить движение» всё видно сразу и просто прокручивается.

// Кривая --ease-out из tokens.css, чтобы анимация шла тем же ходом, что и CSS-переходы.
function tokenEase(CustomEase, name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  const bezier = value.match(/cubic-bezier\(([^)]+)\)/)?.[1].replace(/\s+/g, '');
  return bezier ? CustomEase.create(name.slice(2), bezier) : 'expo.out';
}

function setupOpening() {
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const inner = hero?.querySelector('.hero-inner');
  const logo = hero?.querySelector('.hero-logo');
  const { gsap, ScrollTrigger, CustomEase } = window;
  watchHero();
  if (!inner || !logo || !gsap || !ScrollTrigger || !CustomEase) {
    root.classList.remove('intro');
    return;
  }

  gsap.registerPlugin(ScrollTrigger, CustomEase);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const motion = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

  // Появление, ≈1.6 с: только на самом верху страницы. Начальные значения ставятся до снятия .intro, без мигания.
  if (motion && window.scrollY < 4) {
    gsap.timeline({ defaults: { ease: tokenEase(CustomEase, '--ease-out') } })
      .fromTo(logo, { autoAlpha: 0, scale: 0.95 }, { autoAlpha: 1, scale: 1, duration: 1.3 }, 0)
      .fromTo(hero.querySelectorAll('.hero-inner [data-intro]'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.15 }, 0.7);
  }
  root.classList.remove('intro');
  if (!motion) return;

  gsap.to(inner, {
    y: () => hero.offsetHeight * 0.22,
    scale: 0.94,
    opacity: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: 'bottom top',
      scrub: true,
      invalidateOnRefresh: true,
      onToggle: (self) => hero.classList.toggle('is-playing', self.isActive),
    },
  });
}

// После прыжка по якорю сцена сразу встаёт в своё положение, без догоняющей прокрутки.
function settleScroll() {
  const { ScrollTrigger } = window;
  if (!ScrollTrigger) return;
  ScrollTrigger.update();
  ScrollTrigger.getAll().forEach((st) => st.getTween?.()?.progress(1));
}

// Переход по внутренним ссылкам: страница перелистывается вокруг правого края, как в арабской книге.
// Вперёд по странице лист уходит, назад возвращается. Без View Transitions или при «уменьшить движение»
// работает обычный переход к якорю.
function setupPageTurn() {
  if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href^="#"]');
    if (!link || link.classList.contains('skip-link')) return;
    const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (!target) return;

    const top = target.getBoundingClientRect().top;
    if (Math.abs(top) < 4) return;
    e.preventDefault();

    // Адрес меняется после перелистывания: переход по якорю внутри него прервал бы анимацию.
    const byKeyboard = e.detail === 0;
    root.dataset.turn = top > 0 ? 'forward' : 'back';
    const turn = document.startViewTransition(() => {
      target.scrollIntoView({ behavior: 'instant', block: 'start' });
      settleScroll();
    });
    turn.finished.finally(() => {
      delete root.dataset.turn;
      if (location.hash !== link.hash) history.pushState(null, '', link.hash);
      if (byKeyboard) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  });
}

// В шапке отмечен раздел, который сейчас на экране.
function setupCurrentSection() {
  const links = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  const sections = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  if (!sections.length || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => {
        if (a.hash === `#${entry.target.id}`) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => observer.observe(s));
}

document.addEventListener('DOMContentLoaded', () => {
  setupButtonFeedback();
  setupEnrollLinks();
  setupComposer();
  setupNav();
  setupOpening();
  setupPageTurn();
  setupCurrentSection();
  setupPen();
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
});
