'use strict';

// Контакты записи. WhatsApp-кнопки остаются скрытыми, пока номер пустой.
// Номер в международном формате без «+», например '79991234567'.
const TELEGRAM_USER = 'aliabuturabofficial';
const WHATSAPP_NUMBER = ''; // TODO(заказчик): номер WhatsApp

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

// Шапка прозрачная, пока виден первый экран (класс on-hero на <html> ставит boot.js), дальше ночная.
// Во время сцены перехода её переключает сама сцена; без сцены — этот наблюдатель за hero.
const setOnHero = (on) => document.documentElement.classList.toggle('on-hero', on);

// Без сцены hero прокручивается под шапкой: она темнеет, как только логотип первого экрана
// начинает уходить под неё, и логотип переходит в шапку, а текст hero не бежит под прозрачными ссылками.
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

// ---------- Первый экран и переход: синяя книга логотипа становится вторым блоком ----------
// Сцена на GSAP + ScrollTrigger (vendor/gsap). #about лежит поверх hero, обрезанный clip-path по силуэту
// книги; при прокрутке книга раскрывается и растягивается до краёв экрана. Без GSAP, без JS, при
// «уменьшить движение» и на очень низких экранах hero и #about просто идут друг за другом.

// Силуэт книги: 16 вершин в единицах viewBox логотипа, по часовой от корешка сверху; 8 — корешок-«V» снизу.
// Взяты с контура #logo-book (страницы и обложка), отклонение от кривых не больше 1.2 единицы.
const BOOK = [[160, 140], [177.7, 131.1], [201.6, 125.5], [228, 125], [250, 156], [257, 167], [214.6, 165.6], [179.7, 170.9],
  [160, 177.6], [140.3, 170.9], [105.4, 165.6], [63, 167], [70, 156], [92, 125], [118.4, 125.5], [142.3, 131.1]];
// Куда вершина приходит за краем экрана: x — доля полуширины от середины, y — 0 верх, 1 низ.
// Контур тот же, что у книги: выемка корешка сверху, корешок-«V» снизу ниже углов и уходит за край последним.
// Ни одна вершина не меняет сторону, поэтому при растяжении контур не ломается и не выворачивается.
// Вершина на боковой стороне (4 и 12) везде стоит на той же доле стороны, что в книге, и сторона остаётся прямой.
const EDGE = [[0, 0], [0.26, -0.02], [0.61, -0.04], [1, -0.05], [1, 0.725], [1, 1], [0.56, 1.03], [0.2, 1.06],
  [0, 1.08], [-0.2, 1.06], [-0.56, 1.03], [-1, 1], [-1, 0.725], [-1, -0.05], [-0.61, -0.04], [-0.26, -0.02]];
// Нижний край книги: по верхнему шапка понимает, что синяя страница до неё дошла.
const LOWER = BOOK.map((_, i) => (i >= 4 && i <= 12 ? 1 : 0));
// Плавный вход и выход на отрезке [a, b] общего прогресса сцены.
const smooth = (a, b, t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
// Раскрытая книга: половинки расходятся от корешка, верхний край выпрямляется наполовину.
const OPENED = BOOK.map(([x, y], i) => [160 + (x - 160) * 1.4, LOWER[i] ? y : 125 + (y - 125) * 0.45]);
[[4, 3, 5], [12, 13, 11]].forEach(([i, a, b]) => {
  const k = (BOOK[i][1] - BOOK[a][1]) / (BOOK[b][1] - BOOK[a][1]);
  OPENED[i] = OPENED[a].map((v, j) => v + (OPENED[b][j] - v) * k);
});
const OPENED_WIDTH = 1.4 * (257 - 63);
const BOOK_CENTER = [160, 152];
const SUN_ORIGIN = '160 124';
const SPINE_ORIGIN = '160 154';

// Кривая --ease-out из tokens.css, чтобы анимация шла тем же ходом, что и CSS-переходы.
function tokenEase(CustomEase, name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  const bezier = value.match(/cubic-bezier\(([^)]+)\)/)?.[1].replace(/\s+/g, '');
  return bezier ? CustomEase.create(name.slice(2), bezier) : 'expo.out';
}

function setupOpening() {
  const root = document.documentElement;
  const opening = document.querySelector('[data-opening]');
  const hero = opening?.querySelector('.hero');
  const about = opening?.querySelector('#about');
  const book = hero?.querySelector('#logo-book');
  const header = document.querySelector('.site-header');
  const { gsap, ScrollTrigger, CustomEase } = window;
  if (!book || !about || !gsap || !ScrollTrigger || !CustomEase) {
    root.classList.remove('intro');
    watchHero();
    return;
  }

  gsap.registerPlugin(ScrollTrigger, CustomEase);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const easeOut = tokenEase(CustomEase, '--ease-out');

  const all = (sel) => [...hero.querySelectorAll(sel)];
  const rays = all('#logo-rays path');
  const sun = hero.querySelector('#logo-sun');
  const halves = all('.book-left, .book-right');
  const cover = hero.querySelector('.book-cover');
  const pages = hero.querySelector('#logo-pages');
  const seam = pages.querySelector('.page-seam');
  const lines = [...pages.querySelectorAll('.page-line')];
  const word = hero.querySelector('#logo-word');
  const text = all('.hero-inner [data-intro]');
  const cue = hero.querySelector('.scroll-cue');
  const photo = hero.querySelector('.hero-photo');
  const veil = hero.querySelector('.hero-veil');
  const content = [...about.querySelectorAll('h2, .doubts-text > p, .notes-title, .notes, .ladder, .enroll-line')];
  // размеры книги в единицах логотипа: до любых трансформаций
  const unit = book.getBBox();

  // Точки опоры задаются один раз, пока у частей нет трансформаций: если менять их на ходу, GSAP
  // сдвигает элемент, чтобы тот не прыгнул, и сдвиг остаётся. Масштаб не доходит до нуля: из нулевой
  // матрицы опору уже не восстановить при пересчёте.
  const NONE = 0.001;
  gsap.set(rays, { svgOrigin: SUN_ORIGIN });
  gsap.set(halves, { svgOrigin: SPINE_ORIGIN });
  gsap.set(lines, { svgOrigin: '160 168' });

  // Появление при загрузке, ≈1.6 с: книга раскрывается, солнце поднимается из-за неё, лучи вырастают,
  // затем аят, смысл и описание. Только на самом верху страницы и без «уменьшить движение».
  root.classList.remove('intro');
  // Сцена трогает те же части, что и появление; её шаги добавляются, когда появление закончилось.
  let afterIntro = null;
  const motion = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  const intro = motion && window.scrollY < 4
    ? gsap.timeline({ defaults: { ease: easeOut }, onComplete: () => afterIntro?.() })
      .fromTo([...halves, cover, pages], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power1.out' }, 0)
      .fromTo(halves, { scaleX: 0.85 }, { scaleX: 1, duration: 0.8 }, 0)
      .fromTo(sun, { y: 34 }, { y: 0, duration: 0.9 }, 0.15)
      .fromTo(rays, { scale: NONE }, { scale: 1, duration: 0.6, stagger: { each: 0.04, from: 'center' } }, 0.45)
      .fromTo(word, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.55)
      .fromTo(text, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.12 }, 0.7)
      .fromTo(cue, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 1.1)
    : null;

  const buildScene = (ctx, end, narrow) => {
    opening.classList.add('is-scene');
    // Один прогресс на весь силуэт: раскрытие, рост и растяжение до краёв — его плавные доли,
    // поэтому все вершины идут вместе и контур не ломается.
    const geo = { p: 0 };
    let box = null;

    // Силуэт считается от живого #logo-book, поэтому совпадает с логотипом на любом экране.
    const measure = () => {
      const b = book.getBoundingClientRect();
      const a = about.getBoundingClientRect();
      const h = hero.getBoundingClientRect();
      const s = b.width / unit.width;
      box = {
        s,
        x: b.left - a.left - unit.x * s,
        y: b.top - a.top - unit.y * s,
        left: h.left - a.left,
        top: h.top - a.top,
        w: h.width,
        h: h.height,
        grow: Math.max(1, (h.width * (narrow ? 0.72 : 0.6)) / (OPENED_WIDTH * s)),
        header: header?.offsetHeight ?? 0,
      };
    };

    const draw = () => {
      if (!box) return;
      const { p } = geo;
      if (p >= 1) {
        about.style.clipPath = 'none';
        setOnHero(false);
        return;
      }
      const { s, x, y, left, top, w, h, grow } = box;
      const [cx, cy] = BOOK_CENTER;
      const open = smooth(0, 0.55, p);
      // рост в логарифме: на глаз книга приближается с ровной скоростью, без рывка в конце
      const g = grow ** smooth(0, 0.7, p);
      const t = smooth(0.25, 1, p);
      const pad = 4;
      // ниже края: на телефоне видимая высота бывает больше 100svh
      const bottom = h * 1.12 + pad;
      let edge = Infinity;
      const points = BOOK.map(([bx, by], i) => {
        const ux = bx + (OPENED[i][0] - bx) * open;
        const uy = by + (OPENED[i][1] - by) * open;
        const px = x + (cx + (ux - cx) * g) * s;
        const py = y + (cy + (uy - cy) * g) * s;
        const tx = left + w / 2 + EDGE[i][0] * (w / 2 + pad);
        const ty = top - pad + EDGE[i][1] * (bottom + pad);
        const fy = py + (ty - py) * t;
        if (!LOWER[i]) edge = Math.min(edge, fy - top);
        return `${(px + (tx - px) * t).toFixed(1)}px ${fy.toFixed(1)}px`;
      });
      about.style.clipPath = `polygon(${points.join(', ')})`;
      // шапка темнеет, когда синяя страница дошла до неё
      setOnHero(edge > box.header);
    };

    measure();
    draw();

    // Длина сцены в условных секундах: доля прогресса прокрутки × D.
    // Все шаги — to(): при пересчёте (invalidateOnRefresh) начальные значения берутся заново из покоя;
    // скрытое до 0.75 содержимое #about задано в CSS (.is-scene).
    const D = 3;
    const at = (p) => p * D;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: draw,
      scrollTrigger: {
        trigger: opening,
        start: 'top top',
        end,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefresh: () => { measure(); draw(); },
        // прокрутка во время появления доводит его до конца; первый вызов при создании не в счёт
        onUpdate: () => { if (window.scrollY > 1 && intro?.isActive()) intro.progress(1); },
        onToggle: (self) => opening.classList.toggle('is-playing', self.isActive),
      },
    });

    // 0 → 0.2: текст уходит вверх и тает; лучи втягиваются в солнце, солнце опускается в разворот и гаснет.
    // Эти части только что двигало появление: шаги встают в сцену, когда оно закончилось (или прервано
    // прокруткой), чтобы точкой покоя для них был финальный кадр появления, а не промежуточный.
    let lightAdded = false;
    const addLight = () => ctx.add(() => {
      if (lightAdded) return;
      lightAdded = true;
      tl
        .to([...text, cue], { y: -24, opacity: 0, duration: at(0.22), ease: 'sine.in' }, 0.001)
        .to(rays, { scale: NONE, duration: at(0.18), ease: 'sine.in' }, 0.001)
        .to(sun, { y: 38, autoAlpha: 0, duration: at(0.22), ease: 'sine.inOut' }, at(0.02))
        .to(word, { autoAlpha: 0, duration: at(0.16), ease: 'sine.in' }, 0.001);
    });

    tl
      // В момент старта настоящая книга уступает место синей странице: двойной книги нет.
      .set(book, { autoAlpha: 0 }, 0.001)
      // 0.12 → 0.94: книга раскрывается, растёт и растягивается до краёв одним движением;
      // плавность входа и выхода заложена в draw(), поэтому сам твин линейный
      .to(geo, { p: 1, duration: at(0.82) }, at(0.12))
      // листы веером разлетаются и тают, фото и вуаль уходят назад
      .to(seam, { autoAlpha: 0, duration: at(0.1), ease: 'sine.inOut' }, at(0.12))
      .to(lines, {
        x: (_, el) => Number(el.dataset.side) * 24,
        rotation: (_, el) => Number(el.dataset.side) * -8,
        autoAlpha: 0,
        duration: at(0.3),
        stagger: at(0.02),
        ease: 'sine.inOut',
      }, at(0.14))
      .to(photo, { scale: 1.06, duration: at(0.6), ease: 'sine.inOut' }, at(0.12))
      .to(veil, { opacity: 1, duration: at(0.6), ease: 'sine.inOut' }, at(0.12))
      // 0.66 → 1: содержимое #about поднимается изнутри
      .to(content, { y: 0, opacity: 1, duration: at(0.22), stagger: at(0.03), ease: 'power2.out' }, at(0.66))
      .set({}, {}, D);

    if (intro && intro.progress() < 1) afterIntro = addLight;
    else addLight();

    // Фокус с клавиатуры внутри ещё закрытой страницы: сцена доводится до конца, чтобы было видно, где он.
    const onFocus = () => {
      const st = tl.scrollTrigger;
      if (st && st.progress < 1) window.scrollTo(0, Math.ceil(st.end));
    };
    about.addEventListener('focusin', onFocus);

    return () => {
      afterIntro = null;
      about.removeEventListener('focusin', onFocus);
      opening.classList.remove('is-scene', 'is-playing');
      about.style.clipPath = '';
    };
  };

  const mm = gsap.matchMedia();
  mm.add({
    scene: '(prefers-reduced-motion: no-preference) and (min-height: 30rem)',
    calm: '(prefers-reduced-motion: reduce), (max-height: 29.99rem)',
    narrow: '(max-width: 47.99rem)',
  }, (ctx) => {
    const { scene, narrow } = ctx.conditions;
    if (scene) return buildScene(ctx, narrow ? '+=110%' : '+=140%', narrow);

    // Без сцены: hero и #about подряд, при входе #about короткий переход из бумаги в синий.
    const stop = watchHero();
    if (!motion) {
      gsap.fromTo(about, { opacity: 0 }, {
        opacity: 1,
        duration: 0.3,
        ease: 'none',
        scrollTrigger: { trigger: about, start: 'top 85%', once: true },
      });
    }
    return stop;
  });

  // Арабский шрифт меняет высоту блока: позиции пересчитываются, когда шрифты готовы.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
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
