/* ==========================================================================
   player.js — универсальный модуль видеоплеера с мульти-серверным
   переключателем (TMDB ID)
   ==========================================================================

   АРХИТЕКТУРА:

   Плеер поддерживает произвольное количество "серверов" (источников видео).
   Каждый сервер описывается объектом:
     {
       id: 'server1',              // уникальный ключ
       label: 'Сервер 1',          // подпись на переключателе
       type: 'watch' | 'trailer',  // trailer рендерится через YouTube API
       getUrl: (item) => string|null  // функция, возвращающая embed-URL
     }

   Вкладка «Трейлер» уже работает «из коробки» — использует официальные
   YouTube embed-ссылки из ответа TMDb (videos.results).

   Серверы 1–4 работают по TMDB ID (фильмы и сериалы).
   ========================================================================== */

const Player = (() => {

  /* ---------------------------------------------------------------------
     Вспомогательная функция: достаём TMDB ID и определяем тип контента
     --------------------------------------------------------------------- */
  function getTmdbInfo(item) {
    if (!item) return null;

    // TMDB ID может лежать в разных полях в зависимости от источника данных
    const tmdbId = item.tmdb_id || item.tmdbId || item.tmdb || item.id;
    if (!tmdbId) return null;

    // Определяем, фильм это или сериал
    const isSeries =
      item.media_type === 'tv' ||
      item.type === 'tv' ||
      item.type === 'series' ||
      !!item.number_of_seasons ||
      !!item.season ||
      !!item.episode;

    const season = item.season || item.season_number || 1;
    const episode = item.episode || item.episode_number || 1;

    return { tmdbId, isSeries, season, episode };
  }

  
  function getServer1Url(item) {
    const info = getTmdbInfo(item);
    if (!info) return null;
  }

  function getSources() {
    return [
      { id: 'trailer', label: 'Трейлер', type: 'trailer', getUrl: null },
    ];
  }

  /* ---------------------------------------------------------------------
     Рендер трейлера (YouTube) — работает без дополнительной настройки
     --------------------------------------------------------------------- */
  function getTrailerEmbedUrl(item) {
    const videos = item.videos?.results || [];
    const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer')
      || videos.find(v => v.site === 'YouTube' && v.type === 'Teaser')
      || videos.find(v => v.site === 'YouTube');
    return trailer ? `https://www.youtube.com/embed/${trailer.key}?rel=0&autoplay=1` : null;
  }

  /* ---------------------------------------------------------------------
     Рендер плашки "источник недоступен"
     --------------------------------------------------------------------- */
  function renderUnavailable(message) {
    return `
      <div class="flex flex-col items-center justify-center text-center py-16 px-6 bg-black/30 rounded-xl border border-dashed border-white/10">
        <svg class="w-12 h-12 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p class="text-gray-400 max-w-sm text-sm leading-relaxed">${message}</p>
      </div>
    `;
  }

  /* ---------------------------------------------------------------------
     Рендер плеера для конкретного источника (с обработкой ошибок загрузки)
     --------------------------------------------------------------------- */
  function renderSource(source, item) {
    const embedUrl = source.type === 'trailer' ? getTrailerEmbedUrl(item) : source.getUrl(item);

    if (!embedUrl) {
      const message = source.type === 'trailer'
        ? 'Трейлер не найден в базе TMDb.'
        : `Источник «${source.label}» временно недоступен. Попробуйте другой сервер.`;
      return renderUnavailable(message);
    }

    return `
      <div class="relative w-full aspect-video rounded-xl overflow-hidden bg-black group/player" data-player-wrapper data-source="${source.id}">
        <div class="absolute inset-0 flex items-center justify-center bg-black" data-player-loading>
          <div class="spinner"></div>
        </div>
        <iframe
  src="${embedUrl}"
  class="absolute inset-0 w-full h-full"
  frameborder="0"
  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
  allowfullscreen
  webkitallowfullscreen="true"
  mozallowfullscreen="true"
  loading="lazy"
  sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-orientation-lock"
  referrerpolicy="strict-origin-when-cross-origin"
  data-player-iframe
></iframe>
        <div class="hidden absolute inset-0 flex-col items-center justify-center gap-3 bg-black/95 px-6 text-center" data-player-error>
          <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m0 3.75h.007v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm text-gray-300">Не удалось загрузить видео на этом сервере.</p>
          <p class="text-xs text-gray-500">Попробуйте переключиться на другой источник выше.</p>
        </div>
      </div>
    `;
  }

  /**
   * Инициализирует обработку успешной/неуспешной загрузки iframe.
   * Вызывается сразу после вставки renderSource() в DOM.
   */
  function attachLoadHandlers(container) {
    const wrapper = container.querySelector('[data-player-wrapper]');
    if (!wrapper) return;

    const iframe = wrapper.querySelector('[data-player-iframe]');
    const loading = wrapper.querySelector('[data-player-loading]');
    const errorBox = wrapper.querySelector('[data-player-error]');
    if (!iframe) return;

    let settled = false;
    const timeout = setTimeout(() => {
      // Если iframe долго не отвечает событием load — считаем это ошибкой
      if (!settled) showError();
    }, 12000);

    function hideLoading() {
      settled = true;
      clearTimeout(timeout);
      loading?.classList.add('hidden');
    }

    function showError() {
      settled = true;
      clearTimeout(timeout);
      loading?.classList.add('hidden');
      errorBox?.classList.remove('hidden');
      errorBox?.classList.add('flex');
    }

    iframe.addEventListener('load', hideLoading);
    iframe.addEventListener('error', showError);
  }

  /* ---------------------------------------------------------------------
     Рендер всего блока плеера: переключатель источников + плеер
     --------------------------------------------------------------------- */
  function renderPlayerBlock(item) {
    const sources = getSources();
    const defaultSource = sources[0];

    return `
      <div data-player-block>
        <div class="flex flex-wrap gap-2 mb-4" data-source-switcher>
          ${sources.map((s, i) => `
            <button
              class="source-btn ${i === 0 ? 'active' : ''} px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105 active:scale-95"
              data-source-id="${s.id}"
            >
              ${s.label}
            </button>
          `).join('')}
        </div>
        <div data-player-container>
          ${renderSource(defaultSource, item)}
        </div>
      </div>
    `;
  }

  /** Подключает обработчики кликов по переключателю серверов. Возвращает id активного источника через callback. */
  function setupSourceSwitcher(root, item, onSourceActivated) {
    const sources = getSources();
    const switcher = root.querySelector('[data-source-switcher]');
    const container = root.querySelector('[data-player-container]');
    if (!switcher || !container) return;

    attachLoadHandlers(container);
    if (typeof onSourceActivated === 'function') onSourceActivated(sources[0]);

    switcher.addEventListener('click', (e) => {
      const btn = e.target.closest('.source-btn');
      if (!btn) return;

      const sourceId = btn.dataset.sourceId;
      const source = sources.find(s => s.id === sourceId);
      if (!source) return;

      switcher.querySelectorAll('.source-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      stopAll(container);
      container.innerHTML = renderSource(source, item);
      attachLoadHandlers(container);

      if (typeof onSourceActivated === 'function') onSourceActivated(source);
    });
  }

  /** Полностью останавливает воспроизведение — вызывается при закрытии модалки/смене вкладки */
  function stopAll(container) {
    if (!container) return;
    container.querySelectorAll('iframe').forEach(iframe => {
      iframe.src = 'about:blank';
    });
    container.innerHTML = '';
  }

  return {
    renderPlayerBlock,
    setupSourceSwitcher,
    stopAll,
    getSources,
  };
})();