'use strict';
// Ставится до первой отрисовки: стили анимаций включаются только там, где работает JavaScript.
// on-hero: шапка прозрачная, пока виден первый экран; intro: части первого экрана ждут появления (main.js).
const bootRoot = document.documentElement;
bootRoot.classList.add('js', 'on-hero');
if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches) bootRoot.classList.add('intro');
