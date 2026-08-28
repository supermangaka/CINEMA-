/*ui.js — рендеринг интерфейса*/

const UI = (() => {

  function posterUrl(path, size = 'poster_sm') {
    return path ? `${CONFIG.IMG[size]}${path}` : CONFIG.PLACEHOLDER_POSTER;
  }

  function ratingClass(vote) {
    if (vote >= 7) return 'high';
    if (vote >= 5) return 'mid';
    return 'low';
  }

  function formatYear(dateStr) {
    return dateStr ? dateStr.slice(0, 4) : '—';
  }

  /*Карточка фильма/сериала*/
  function movieCard(item) {
    const title = item.title || item.name || 'Без названия';
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    const year = formatYear(item.release_date || item.first_air_date);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const isFav = Favorites.isFavorite(item.id, mediaType);

    return `
      <div class="movie-card fade-in" data-id="${item.id}" data-media-type="${mediaType}" data-poster="${item.poster_path || ''}" data-vote="${item.vote_average || 0}" data-date="${item.release_date || item.first_air_date || ''}" role="button" tabindex="0">
        <img src="${posterUrl(item.poster_path)}" alt="${escapeHtml(title)}" loading="lazy"
             onerror="this.src='${CONFIG.PLACEHOLDER_POSTER}'">

        <button class="fav-btn absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/55 backdrop-blur-md flex items-center justify-center hover:bg-black/80 transition-colors"
                data-fav-id="${item.id}" data-fav-type="${mediaType}" aria-label="В избранное">
          <svg class="w-4 h-4 ${isFav ? 'fill-accent stroke-accent' : 'fill-none stroke-white'}" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-1-.9-9-7.3-9-13a5 5 0 019-3 5 5 0 019 3c0 5.7-8 12.1-9 13z"/>
          </svg>
        </button>

        <div class="play-fab">
          <svg class="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
        </div>

        <div class="movie-card-overlay">
          <p class="movie-card-title">${escapeHtml(title)}</p>
          <div class="movie-card-meta">
            <span class="rating-badge ${ratingClass(item.vote_average)}">★ ${rating}</span>
            <span>${year}</span>
          </div>
        </div>
      </div>
    `;
  }

  function skeletonCard() {
    return `<div class="skeleton skeleton-card"></div>`;
  }

  function skeletonRow(count = 6) {
    return Array.from({ length: count }, skeletonCard).join('');
  }

  /* Ряд карточек (слайдер)*/
  function renderRow(container, { title, rowId }) {
    const el = document.createElement('section');
    el.className = 'mb-10 md:mb-14';
    el.innerHTML = `
      <div class="row-heading">
        <span>${title}</span>
        <div class="hidden md:flex gap-2">
          <button class="row-scroll-btn" data-scroll="left" data-row="${rowId}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button class="row-scroll-btn" data-scroll="right" data-row="${rowId}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
      <div class="movie-row-track" id="row-${rowId}">${skeletonRow()}</div>
    `;
    container.appendChild(el);
    return document.getElementById(`row-${rowId}`);
  }

  function fillRow(trackEl, items, mediaTypeFallback) {
    if (!items || items.length === 0) {
      trackEl.innerHTML = `<p class="text-gray-500 text-sm py-8">Не удалось загрузить контент.</p>`;
      return;
    }
    trackEl.innerHTML = items
      .filter(i => i.poster_path)
      .map(i => movieCard({ ...i, media_type: i.media_type || mediaTypeFallback }))
      .join('');
  }

  /*Hero-баннер*/
  function renderHero(item) {
    const skeleton = document.getElementById('hero-skeleton');
    const content = document.getElementById('hero-content');
    const title = item.title || item.name;

    document.getElementById('hero-backdrop').src = posterUrl(item.backdrop_path, 'backdrop');
    document.getElementById('hero-title').textContent = title;
    document.getElementById('hero-overview').textContent = item.overview || '';

    content.dataset.id = item.id;
    content.dataset.mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');

    skeleton.classList.add('hidden');
    content.classList.remove('opacity-0');
  }

  /* Модальное окно */
  function renderModal(item) {
    const title = item.title || item.name;
    const mediaType = item.media_type;
    const year = formatYear(item.release_date || item.first_air_date);
    const runtime = item.runtime
      ? `${Math.floor(item.runtime / 60)} ч ${item.runtime % 60} мин`
      : (item.episode_run_time?.[0] ? `~${item.episode_run_time[0]} мин / серия` : '');
    const genres = (item.genres || []).map(g => g.name).join(', ');
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const cast = (item.credits?.cast || []).slice(0, 12);
    const isFav = Favorites.isFavorite(item.id, mediaType);

    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
      <div class="relative w-full h-56 md:h-80">
        <img src="${posterUrl(item.backdrop_path, 'backdrop')}" alt="" class="absolute inset-0 w-full h-full object-cover"
             onerror="this.style.display='none'">
        <div class="absolute inset-0 bg-gradient-to-t from-bg-surface via-bg-surface/40 to-transparent"></div>
      </div>

      <div class="px-5 md:px-8 pb-8 -mt-16 relative">
        <div class="flex gap-4 md:gap-6 items-end mb-5">
          <img src="${posterUrl(item.poster_path)}" alt="${escapeHtml(title)}"
               class="w-24 md:w-36 rounded-xl shadow-2xl border border-white/10 shrink-0"
               onerror="this.src='${CONFIG.PLACEHOLDER_POSTER}'">
          <div class="pb-1">
            <h2 class="text-xl md:text-3xl font-extrabold leading-tight mb-2">${escapeHtml(title)}</h2>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-gray-300">
              <span class="rating-badge ${ratingClass(item.vote_average)}">★ ${rating}</span>
              <span>${year}</span>
              ${runtime ? `<span>${runtime}</span>` : ''}
              <span class="uppercase text-[10px] font-bold tracking-wide px-2 py-0.5 rounded bg-white/10">
                ${mediaType === 'tv' ? 'Сериал' : 'Фильм'}
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 mb-6">
          <button id="modal-fav-btn" class="flex items-center gap-2 glass-btn px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95">
            <svg class="w-4 h-4 ${isFav ? 'fill-accent stroke-accent' : 'fill-none stroke-white'}" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-1-.9-9-7.3-9-13a5 5 0 019-3 5 5 0 019 3c0 5.7-8 12.1-9 13z"/>
            </svg>
            <span id="modal-fav-label">${isFav ? 'В избранном' : 'В избранное'}</span>
          </button>
        </div>

        ${genres ? `<p class="text-sm text-gray-400 mb-4"><span class="text-gray-500">Жанры:</span> ${escapeHtml(genres)}</p>` : ''}
        <p class="text-sm md:text-base text-gray-200 leading-relaxed mb-7">${escapeHtml(item.overview || 'Описание отсутствует.')}</p>

        ${cast.length ? `
          <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">В ролях</h3>
          <div class="cast-scroll mb-8">
            ${cast.map(actor => `
              <div class="cast-item cursor-pointer" data-person-id="${actor.id}" role="button" tabindex="0">
                <img src="${actor.profile_path ? CONFIG.IMG.profile + actor.profile_path : CONFIG.PLACEHOLDER_POSTER}"
                     alt="${escapeHtml(actor.name)}" onerror="this.src='${CONFIG.PLACEHOLDER_POSTER}'">
                <span>${escapeHtml(actor.name)}</span>
                ${actor.character ? `<span class="block text-[10px] text-gray-500 mt-0.5 truncate">${escapeHtml(actor.character)}</span>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">Смотреть</h3>
        <div id="modal-player-root">${Player.renderPlayerBlock(item)}</div>
      </div>
    `;

    // Подключаем переключатель серверов; при активации любого источника
    // (включая источник по умолчанию) фиксируем просмотр в истории
    // авторизованного пользователя.
    const playerRoot = document.getElementById('modal-player-root');
    Player.setupSourceSwitcher(playerRoot, item, (source) => {
      const user = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null;
      if (user && typeof History !== 'undefined') {
        History.add(user.id, item);
      }
    });

    document.getElementById('modal-fav-btn').addEventListener('click', () => {
      const added = Favorites.toggle(item);
      const icon = document.querySelector('#modal-fav-btn svg');
      const label = document.getElementById('modal-fav-label');
      icon.classList.toggle('fill-accent', added);
      icon.classList.toggle('stroke-accent', added);
      icon.classList.toggle('fill-none', !added);
      icon.classList.toggle('stroke-white', !added);
      label.textContent = added ? 'В избранном' : 'В избранное';
      showToast(added ? 'Добавлено в избранное' : 'Удалено из избранного');
      document.dispatchEvent(new CustomEvent('favorites-changed'));
    });
  }

  /*Toast*/
  let toastTimer = null;
  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  /* ---------------------------------------------------------------------
     Прокрутка каруселей колесиком мыши.
     Один делегированный обработчик на весь документ подхватывает ЛЮБУЮ
     горизонтальную ленту (.movie-row-track — ряды фильмов на главной/в
     разделах/в поиске, .cast-scroll — актёрский состав, а также карусель
     фильмографии актёра, которая использует тот же класс .movie-row-track)
     без необходимости переподключать обработчик после каждой перерисовки.
     --------------------------------------------------------------------- */
  function setupWheelScroll() {
    const SELECTOR = '.movie-row-track, .cast-scroll';
    const SPEED_MULTIPLIER = 2.2; // ускоряем горизонтальный скролл относительно вертикального деltaY

    document.addEventListener('wheel', (e) => {
      const track = e.target.closest(SELECTOR);
      if (!track) return;

      // Если лента физически не прокручивается (все карточки помещаются
      // на экране) — не перехватываем событие, пусть страница скроллится как обычно.
      if (track.scrollWidth <= track.clientWidth) return;

      e.preventDefault();
      track.scrollLeft += e.deltaY * SPEED_MULTIPLIER;
    }, { passive: false });
  }

  return {
    movieCard, skeletonRow, renderRow, fillRow,
    renderHero, renderModal, showToast, posterUrl, escapeHtml,
    setupWheelScroll,
  };
})();
