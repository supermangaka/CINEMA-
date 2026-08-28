/*app.js — точка входа, оркестрация всего приложения*/

(() => {
  const state = {
    category: 'home', // home | movie | tv | animation | favorites
    genres: { movie: [], tv: [] },
  };

  const rowsContainer = document.getElementById('rows-container');
  const heroSection = document.getElementById('hero');
  const contentWrapper = document.getElementById('content-wrapper');
  const filtersBar = document.getElementById('filters-bar');
  const searchInput = document.getElementById('search-input');
  const searchSection = document.getElementById('search-results-section');
  const searchGrid = document.getElementById('search-results-grid');
  const searchEmpty = document.getElementById('search-empty');
  const searchTitle = document.getElementById('search-results-title');

  /*ИНИЦИАЛИЗАЦИЯ*/
  async function init() {
    setupHeaderScroll();
    setupMobileMenu();
    setupNav();
    setupSearch();
    setupFilters();
    setupModal();
    setupDelegatedFavClicks();
    setupAuth();
    setupProfile();
    Actors.setup();
    UI.setupWheelScroll();
    refreshAuthUI();

    await loadHero();
    await loadHomeRows();
  }

  /** Переключает отступ контента: hero виден → отрицательный "наезд";
   *  hero скрыт (разделы/поиск) → положительный padding, чтобы шапка
   *  не перекрывала первый ряд карточек. */
  function toggleHeroSpacing(heroVisible) {
    contentWrapper.classList.toggle('no-hero', !heroVisible);
    contentWrapper.classList.toggle('-mt-8', heroVisible);
    contentWrapper.classList.toggle('md:-mt-16', heroVisible);
  }

  /*HEADER: скролл-эффект*/
  function setupHeaderScroll() {
    const headerGlass = document.querySelector('.glass-header');
    window.addEventListener('scroll', () => {
      headerGlass.classList.toggle('scrolled', window.scrollY > 40);
    });
  }

  function setupMobileMenu() {
    const burger = document.getElementById('burger-btn');
    const menu = document.getElementById('mobile-menu');
    burger.addEventListener('click', () => menu.classList.toggle('hidden'));
  }

  /*НАВИГАЦИЯ ПО КАТЕГОРИЯМ*/
  function setupNav() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const category = link.dataset.category;
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll(`[data-category="${category}"]`).forEach(l => l.classList.add('active'));
        document.getElementById('mobile-menu').classList.add('hidden');
        searchInput.value = '';
        await switchCategory(category);
      });
    });

    document.getElementById('logo-home').addEventListener('click', async (e) => {
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      searchInput.value = '';
      await switchCategory('home');
    });
  }

  async function switchCategory(category) {
    state.category = category;
    searchSection.classList.add('hidden');
    rowsContainer.innerHTML = '';

    if (category === 'home') {
      heroSection.classList.remove('hidden');
      toggleHeroSpacing(true);
      filtersBar.classList.add('hidden');
      filtersBar.classList.remove('flex');
      await loadHomeRows();
      return;
    }

    heroSection.classList.add('hidden');
    toggleHeroSpacing(false);

    if (category === 'favorites') {
      filtersBar.classList.add('hidden');
      filtersBar.classList.remove('flex');
      renderFavoritesRow();
      return;
    }

    filtersBar.classList.remove('hidden');
    filtersBar.classList.add('flex');
    await populateFilters(category);
    await loadCategoryRows(category);
  }

  /*HERO*/
  async function loadHero() {
    try {
      const data = await API.getTrending('all', 'week');
      const candidates = (data.results || []).filter(i => i.backdrop_path && (i.media_type === 'movie' || i.media_type === 'tv'));
      const pick = candidates[Math.floor(Math.random() * Math.min(candidates.length, 8))] || candidates[0];
      if (pick) UI.renderHero(pick);
    } catch (error) {
      console.error('Не удалось загрузить hero-баннер:', error);
      document.getElementById('hero-skeleton').innerHTML =
        `<div class="w-full h-full flex items-center justify-center text-gray-500 text-sm">Не удалось загрузить контент. Проверьте API-ключ в js/config.js</div>`;
    }
  }

  document.getElementById('hero-play-btn')?.addEventListener('click', openHeroModal);
  document.getElementById('hero-info-btn')?.addEventListener('click', openHeroModal);
  async function openHeroModal() {
    const content = document.getElementById('hero-content');
    const id = content.dataset.id;
    const mediaType = content.dataset.mediaType;
    if (id) await openModal(id, mediaType);
  }

  /*ГЛАВНАЯ: РЯДЫ (Тренды/Популярное/Новинки)*/
  async function loadHomeRows() {
    const rows = [
      { id: 'trending', title: 'В тренде', loader: () => API.getTrending('all', 'week') },
      { id: 'popular-movie', title: 'Популярные фильмы', loader: () => API.getPopular('movie'), fallback: 'movie' },
      { id: 'popular-tv', title: 'Популярные сериалы', loader: () => API.getPopular('tv'), fallback: 'tv' },
      { id: 'new', title: 'Новинки', loader: () => API.getNowPlaying('movie'), fallback: 'movie' },
      { id: 'top-rated', title: 'Топ рейтинга', loader: () => API.getTopRated('movie'), fallback: 'movie' },
      { id: 'animation', title: 'Мультфильмы', loader: () => API.discover('animation'), fallback: 'movie' },
    ];
    await loadRows(rows);
  }

  async function loadCategoryRows(category) {
    const label = category === 'tv' ? 'сериалов' : (category === 'animation' ? 'мультфильмов' : 'фильмов');
    const rows = [
      { id: `${category}-popular`, title: `Популярные ${label}`, loader: () => API.discover(category), fallback: category === 'animation' ? 'movie' : category },
      { id: `${category}-top`, title: `Топ рейтинга`, loader: () => API.getTopRated(category === 'animation' ? 'movie' : category), fallback: category === 'animation' ? 'movie' : category },
    ];
    await loadRows(rows);
  }

  async function loadRows(rows) {
    const tracks = rows.map(row => ({ row, track: UI.renderRow(rowsContainer, { title: row.title, rowId: row.id }) }));

    await Promise.all(tracks.map(async ({ row, track }) => {
      try {
        const data = await row.loader();
        UI.fillRow(track, data.results, row.fallback);
      } catch (error) {
        console.error(`Ошибка загрузки ряда "${row.title}":`, error);
        track.innerHTML = `<p class="text-gray-500 text-sm py-8">Не удалось загрузить. Проверьте API-ключ в js/config.js</p>`;
      }
    }));

    setupRowScrollButtons();
  }

  function setupRowScrollButtons() {
    document.querySelectorAll('.row-scroll-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const track = document.getElementById(`row-${btn.dataset.row}`);
        const amount = track.clientWidth * 0.8;
        track.scrollBy({ left: btn.dataset.scroll === 'left' ? -amount : amount, behavior: 'smooth' });
      });
    });
  }

  /*ИЗБРАННОЕ*/
  function renderFavoritesRow() {
    rowsContainer.innerHTML = '';
    const favs = Favorites.getAll();

    const section = document.createElement('section');
    section.innerHTML = `<h2 class="text-xl md:text-2xl font-bold mb-5">Моё избранное</h2>`;
    const grid = document.createElement('div');
    grid.className = 'content-grid';

    if (favs.length === 0) {
      grid.innerHTML = `<p class="text-gray-400 col-span-full text-center py-16">Список избранного пуст. Добавляйте фильмы и сериалы, нажимая на ♥ на карточке.</p>`;
    } else {
      grid.innerHTML = favs.map(f => UI.movieCard({
        id: f.id, media_type: f.media_type, title: f.title, name: f.title,
        poster_path: f.poster_path, vote_average: f.vote_average, release_date: f.release_date,
      })).join('');
    }
    section.appendChild(grid);
    rowsContainer.appendChild(section);
  }

  document.addEventListener('favorites-changed', () => {
    if (state.category === 'favorites') renderFavoritesRow();
  });

  /*ПОИСК (debounce)*/
  function debounce(fn, delay = 400) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function setupSearch() {
    const handleSearch = debounce(async (query) => {
      if (!query.trim()) {
        searchSection.classList.add('hidden');
        if (state.category === 'home') {
          heroSection.classList.remove('hidden');
          toggleHeroSpacing(true);
        }
        return;
      }

      heroSection.classList.add('hidden');
      toggleHeroSpacing(false);
      filtersBar.classList.add('hidden');
      rowsContainer.innerHTML = '';
      searchSection.classList.remove('hidden');
      searchTitle.textContent = `Результаты по запросу «${query}»`;
      searchGrid.innerHTML = UI.skeletonRow(12).replace(/skeleton-card/g, 'skeleton');
      searchEmpty.classList.add('hidden');

      try {
        const data = await API.search(query);
        const results = (data.results || []).filter(i =>
          (i.media_type === 'movie' || i.media_type === 'tv') && i.poster_path
        );

        if (results.length === 0) {
          searchGrid.innerHTML = '';
          searchEmpty.classList.remove('hidden');
        } else {
          searchGrid.innerHTML = results.map(UI.movieCard).join('');
        }
      } catch (error) {
        console.error('Ошибка поиска:', error);
        searchGrid.innerHTML = `<p class="text-gray-500 col-span-full text-center py-16">Не удалось выполнить поиск. Проверьте API-ключ в js/config.js</p>`;
      }
    }, 450);

    searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  }

  /*ФИЛЬТРЫ*/
  /**
   * Заполняет выпадающие списки жанров и годов под конкретный раздел.
   * @param {string} category - 'movie' | 'tv' | 'animation'
   */
  async function populateFilters(category) {
    const genreSelect = document.getElementById('filter-genre');
    const yearSelect = document.getElementById('filter-year');
    const mediaType = category === 'animation' ? 'movie' : category;

    try {
      if (!state.genres[mediaType] || state.genres[mediaType].length === 0) {
        const data = await API.getGenres(mediaType);
        state.genres[mediaType] = data.genres || [];
      }

      // Для раздела "Мультфильмы" жанр Animation (id=16) уже применяется
      // автоматически ко всем запросам (см. API.discover), поэтому убираем
      // его из выпадающего списка, чтобы не дублировать сам себя.
      const genresToShow = category === 'animation'
        ? state.genres[mediaType].filter(g => g.id !== 16)
        : state.genres[mediaType];

      genreSelect.innerHTML = '<option value="">Все жанры</option>' +
        genresToShow.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    } catch (error) {
      console.error('Не удалось загрузить жанры:', error);
      genreSelect.innerHTML = '<option value="">Все жанры</option>';
    }

    const currentYear = new Date().getFullYear();
    let yearOptions = '<option value="">Любой год</option>';
    for (let y = currentYear; y >= 1970; y--) {
      yearOptions += `<option value="${y}">${y}</option>`;
    }
    yearSelect.innerHTML = yearOptions;

    // Сбрасываем выбранный жанр при переключении раздела, чтобы старое
    // значение (актуальное для прошлой категории) не "утекало" в новую
    genreSelect.value = '';
  }

  function setupFilters() {
    const sortSelect = document.getElementById('filter-sort');
    const genreSelect = document.getElementById('filter-genre');
    const yearSelect = document.getElementById('filter-year');
    const ratingSelect = document.getElementById('filter-rating');
    const resetBtn = document.getElementById('filter-reset');

    const applyFilters = debounce(async () => {
      const category = state.category === 'animation' ? 'animation' : state.category;
      const filters = {
        sort: sortSelect.value,
        genre: genreSelect.value,
        year: yearSelect.value,
        rating: ratingSelect.value,
      };

      rowsContainer.innerHTML = '';
      const track = UI.renderRow(rowsContainer, { title: 'Результаты фильтрации', rowId: 'filtered' });

      try {
        const data = await API.discover(category, filters);
        UI.fillRow(track, data.results, category === 'animation' ? 'movie' : category);
      } catch (error) {
        console.error('Ошибка фильтрации:', error);
        track.innerHTML = `<p class="text-gray-500 text-sm py-8">Не удалось применить фильтры.</p>`;
      }
      setupRowScrollButtons();
    }, 200);

    [sortSelect, genreSelect, yearSelect, ratingSelect].forEach(el => el.addEventListener('change', applyFilters));

    resetBtn.addEventListener('click', () => {
      sortSelect.value = 'popularity.desc';
      genreSelect.value = '';
      yearSelect.value = '';
      ratingSelect.value = '';
      loadCategoryRows(state.category);
    });
  }

  /*МОДАЛЬНОЕ ОКНО*/
  function setupModal() {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeModal();
    });
  }

  function setupDelegatedFavClicks() {
    document.addEventListener('click', (e) => {
      const favBtn = e.target.closest('.fav-btn');
      if (favBtn) {
        e.stopPropagation();
        const id = Number(favBtn.dataset.favId);
        const mediaType = favBtn.dataset.favType;
        const card = favBtn.closest('.movie-card');
        const title = card.querySelector('.movie-card-title')?.textContent || '';

        const added = Favorites.toggle({
          id, media_type: mediaType, title, name: title,
          poster_path: card.dataset.poster || null,
          vote_average: Number(card.dataset.vote) || 0,
          release_date: card.dataset.date || '',
        });

        const svg = favBtn.querySelector('svg');
        svg.classList.toggle('fill-accent', added);
        svg.classList.toggle('stroke-accent', added);
        svg.classList.toggle('fill-none', !added);
        svg.classList.toggle('stroke-white', !added);

        UI.showToast(added ? 'Добавлено в избранное' : 'Удалено из избранного');
        document.dispatchEvent(new CustomEvent('favorites-changed'));
        return;
      }

      const card = e.target.closest('.movie-card');
      if (card) {
        openModal(card.dataset.id, card.dataset.mediaType);
      }
    });
  }

  async function openModal(id, mediaType) {
    const overlay = document.getElementById('modal-overlay');
    const modalBody = document.getElementById('modal-body');

    modalBody.innerHTML = `<div class="flex items-center justify-center py-32"><div class="spinner"></div></div>`;
    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');

    try {
      const item = await API.getDetails(id, mediaType);
      item.media_type = mediaType;
      UI.renderModal(item);
    } catch (error) {
      console.error('Не удалось загрузить детали:', error);
      modalBody.innerHTML = `
        <div class="flex flex-col items-center justify-center py-32 px-6 text-center">
          <p class="text-gray-400">Не удалось загрузить информацию. Проверьте API-ключ в js/config.js</p>
        </div>
      `;
    }
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    const playerContainer = document.querySelector('#modal-player-root [data-player-container]');
    Player.stopAll(playerContainer);
    overlay.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  /*АВТОРИЗАЦИЯ*/
  function setupAuth() {
    const overlay = document.getElementById('auth-overlay');
    const closeBtn = document.getElementById('auth-close');
    const openBtn = document.getElementById('auth-open-btn');
    const mobileOpenBtn = document.getElementById('mobile-auth-btn');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');

    function openAuth() {
      overlay.classList.remove('hidden');
      document.body.classList.add('modal-open');
    }
    function closeAuth() {
      overlay.classList.add('hidden');
      document.body.classList.remove('modal-open');
      loginForm.reset();
      registerForm.reset();
      clearFieldErrors(loginForm);
      clearFieldErrors(registerForm);
      loginError.classList.add('hidden');
      registerError.classList.add('hidden');
    }

    openBtn.addEventListener('click', openAuth);
    mobileOpenBtn.addEventListener('click', () => {
      document.getElementById('mobile-menu').classList.add('hidden');
      if (Auth.isLoggedIn()) {
        openProfile();
      } else {
        openAuth();
      }
    });
    closeBtn.addEventListener('click', closeAuth);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAuth(); });

    // Переключение вкладок Вход / Регистрация
    overlay.querySelectorAll('[data-auth-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        overlay.querySelectorAll('[data-auth-tab]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const isLogin = tab.dataset.authTab === 'login';
        loginForm.classList.toggle('hidden', !isLogin);
        loginForm.classList.toggle('flex', isLogin);
        registerForm.classList.toggle('hidden', isLogin);
        registerForm.classList.toggle('flex', !isLogin);
        clearFieldErrors(loginForm);
        clearFieldErrors(registerForm);
        loginError.classList.add('hidden');
        registerError.classList.add('hidden');
      });
    });

    /** Показывает ошибки под конкретными полями формы по карте { fieldKey: message } */
    function showFieldErrors(form, fieldMap, errors) {
      clearFieldErrors(form);
      Object.entries(errors).forEach(([key, message]) => {
        const inputId = fieldMap[key];
        if (!inputId) return;
        const input = document.getElementById(inputId);
        const errorEl = form.querySelector(`[data-error-for="${inputId}"]`);
        input?.classList.add('invalid');
        if (errorEl) {
          errorEl.textContent = message;
          errorEl.classList.remove('hidden');
        }
      });
    }

    function clearFieldErrors(form) {
      form.querySelectorAll('.auth-input').forEach(el => el.classList.remove('invalid'));
      form.querySelectorAll('.field-error').forEach(el => {
        el.textContent = '';
        el.classList.add('hidden');
      });
    }

    // Снимаем состояние "invalid" с поля, как только пользователь начал его исправлять
    [loginForm, registerForm].forEach(form => {
      form.querySelectorAll('.auth-input').forEach(input => {
        input.addEventListener('input', () => {
          input.classList.remove('invalid');
          const errorEl = form.querySelector(`[data-error-for="${input.id}"]`);
          errorEl?.classList.add('hidden');
        });
      });
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.classList.add('hidden');

      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;

      const { valid, errors } = Auth.validateLogin({ email, password });
      if (!valid) {
        showFieldErrors(loginForm, { email: 'login-email', password: 'login-password' }, errors);
        return;
      }

      try {
        await Auth.login({ email, password });
        closeAuth();
        refreshAuthUI();
        UI.showToast('Вы успешно вошли в аккаунт');
      } catch (error) {
        loginError.textContent = error.message;
        loginError.classList.remove('hidden');
      }
    });

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      registerError.classList.add('hidden');

      const name = document.getElementById('register-name').value;
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      const passwordConfirm = document.getElementById('register-password-confirm').value;

      const { valid, errors } = Auth.validateRegister({ name, email, password, passwordConfirm });
      if (!valid) {
        showFieldErrors(registerForm, {
          name: 'register-name',
          email: 'register-email',
          password: 'register-password',
          passwordConfirm: 'register-password-confirm',
        }, errors);
        return;
      }

      try {
        await Auth.register({ name, email, password });
        closeAuth();
        refreshAuthUI();
        UI.showToast('Аккаунт создан, добро пожаловать!');
      } catch (error) {
        registerError.textContent = error.message;
        registerError.classList.remove('hidden');
      }
    });
  }

  /** Показывает кнопку "Войти" или аватар профиля в зависимости от статуса сессии.
   *  Видимость самих кнопок управляется CSS через класс body.is-authenticated
   *  (см. css/style.css) — так надёжнее, чем напрямую дёргать Tailwind-классы
   *  display, которые конфликтуют с responsive-модификаторами (sm:flex). */
  function refreshAuthUI() {
    const user = Auth.getCurrentUser();
    document.body.classList.toggle('is-authenticated', !!user);
    if (user) Profile.applyAvatar(user);
  }

  /*ПРОФИЛЬ*/
  function setupProfile() {
    const overlay = document.getElementById('profile-overlay');
    const closeBtn = document.getElementById('profile-close');
    const openBtn = document.getElementById('profile-open-btn');
    const logoutBtn = document.getElementById('logout-btn');

    openBtn.addEventListener('click', openProfile);
    closeBtn.addEventListener('click', closeProfile);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeProfile(); });

    logoutBtn.addEventListener('click', () => {
      Auth.logout();
      closeProfile();
      refreshAuthUI();
      UI.showToast('Вы вышли из аккаунта');
    });

    Profile.setupTabs();
    Profile.setupSettingsTab();
  }

  /** Возвращает модалку профиля к вкладке "Избранное" (сбрасывает состояние с прошлого открытия) */
  function resetProfileTabs() {
    document.querySelectorAll('[data-profile-tab]').forEach(t => t.classList.remove('active'));
    document.querySelector('[data-profile-tab="favorites"]')?.classList.add('active');

    const favoritesPanel = document.getElementById('profile-favorites-panel');
    const historyPanel = document.getElementById('profile-history-panel');
    const settingsPanel = document.getElementById('profile-settings-panel');

    favoritesPanel.classList.remove('hidden');
    favoritesPanel.classList.add('content-grid');
    historyPanel.classList.add('hidden');
    historyPanel.classList.remove('flex');
    settingsPanel.classList.add('hidden');
    settingsPanel.classList.remove('flex');
  }

  function openProfile() {
    const user = Auth.getCurrentUser();
    if (!user) return;
    resetProfileTabs();
    Profile.render(user);
    document.getElementById('profile-overlay').classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeProfile() {
    document.getElementById('profile-overlay').classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  /*СТАРТ */
  document.addEventListener('DOMContentLoaded', init);
})();
