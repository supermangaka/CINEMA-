/*actors.js — модальное окно актёра: биография + фильмография (TMDb API)*/

const Actors = (() => {

  /** Форматирует дату рождения/смерти в читаемый русский вид */
  function formatDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /** Считает возраст на основе даты рождения (и, если есть, даты смерти) */
  function calcAge(birthday, deathday) {
    if (!birthday) return null;
    const from = new Date(birthday);
    const to = deathday ? new Date(deathday) : new Date();
    let age = to.getFullYear() - from.getFullYear();
    const monthDiff = to.getMonth() - from.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && to.getDate() < from.getDate())) age--;
    return age;
  }

  /** Отбирает и сортирует лучшие роли персоны для отображения в карусели */
  function pickTopCredits(credits) {
    const combined = [...(credits.cast || [])];
    return combined
      .filter(c => c.poster_path && (c.media_type === 'movie' || c.media_type === 'tv'))
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 20);
  }

  /*Рендер содержимого карточки актёра внутри уже открытого overlay*/
  function renderPersonModal(person, credits) {
    const body = document.getElementById('actor-modal-body');
    const age = calcAge(person.birthday, person.deathday);
    const birthInfo = [formatDate(person.birthday), age ? `${age} лет` : null].filter(Boolean).join(', ');
    const topCredits = pickTopCredits(credits);

    body.innerHTML = `
      <div class="flex flex-col md:flex-row gap-6 md:gap-8">
        <img
          src="${person.profile_path ? CONFIG.IMG.profile_lg + person.profile_path : CONFIG.PLACEHOLDER_POSTER}"
          alt="${UI.escapeHtml(person.name)}"
          class="w-32 md:w-48 rounded-xl border border-white/10 shadow-2xl shrink-0 mx-auto md:mx-0"
          onerror="this.src='${CONFIG.PLACEHOLDER_POSTER}'"
        >
        <div class="flex-1 min-w-0">
          <h2 class="text-xl md:text-3xl font-extrabold mb-3">${UI.escapeHtml(person.name)}</h2>

          <div class="flex flex-col gap-1.5 text-sm text-gray-300 mb-5">
            ${birthInfo ? `
              <p><span class="text-gray-500">Дата рождения:</span> ${birthInfo}${person.deathday ? ` <span class="text-gray-500">(ум. ${formatDate(person.deathday)})</span>` : ''}</p>
            ` : ''}
            ${person.place_of_birth ? `<p><span class="text-gray-500">Место рождения:</span> ${UI.escapeHtml(person.place_of_birth)}</p>` : ''}
            ${person.known_for_department ? `<p><span class="text-gray-500">Деятельность:</span> ${UI.escapeHtml(translateDepartment(person.known_for_department))}</p>` : ''}
          </div>

          ${person.biography ? `
            <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wide mb-2">Биография</h3>
            <p class="text-sm text-gray-200 leading-relaxed line-clamp-6 md:line-clamp-none">${UI.escapeHtml(person.biography)}</p>
          ` : `<p class="text-sm text-gray-500 italic">Биография отсутствует в базе TMDb.</p>`}
        </div>
      </div>

      ${topCredits.length ? `
        <div class="mt-8">
          <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">Фильмография</h3>
          <div class="movie-row-track" id="actor-filmography-track">
            ${topCredits.map(c => UI.movieCard({
              id: c.id,
              media_type: c.media_type,
              title: c.title,
              name: c.name,
              poster_path: c.poster_path,
              vote_average: c.vote_average,
              release_date: c.release_date || c.first_air_date,
            })).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  function translateDepartment(dept) {
    const map = {
      Acting: 'Актёрское мастерство',
      Directing: 'Режиссура',
      Writing: 'Сценарист',
      Production: 'Продюсирование',
      Sound: 'Звукорежиссура',
      Camera: 'Оператор',
    };
    return map[dept] || dept;
  }

  /*Открытие/закрытие модалки актёра*/
  async function open(personId) {
    const overlay = document.getElementById('actor-overlay');
    const body = document.getElementById('actor-modal-body');

    body.innerHTML = `<div class="flex items-center justify-center py-32"><div class="spinner"></div></div>`;
    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');

    try {
      const [person, credits] = await Promise.all([
        API.getPersonDetails(personId),
        API.getPersonCombinedCredits(personId),
      ]);
      renderPersonModal(person, credits);
    } catch (error) {
      console.error('Не удалось загрузить данные актёра:', error);
      body.innerHTML = `
        <div class="flex flex-col items-center justify-center py-32 px-6 text-center">
          <p class="text-gray-400">Не удалось загрузить информацию об актёре. Проверьте API-ключ в js/config.js</p>
        </div>
      `;
    }
  }

  function close() {
    document.getElementById('actor-overlay').classList.add('hidden');
    // Если позади остаётся открытой модалка фильма/сериала — не снимаем
    // блокировку скролла body, иначе фон "прыгнет" под открытой модалкой.
    const movieModalOpen = !document.getElementById('modal-overlay').classList.contains('hidden');
    if (!movieModalOpen) {
      document.body.classList.remove('modal-open');
    }
  }

  /**
   * Подключает делегированные обработчики:
   * - клик по .cast-item внутри модалки фильма/сериала → открыть карточку актёра
   * - клик по карточке фильма внутри карусели фильмографии актёра закрывает
   *   карточку актёра; само открытие фильма обрабатывает общий делегированный
   *   обработчик .movie-card в app.js (он сработает на тот же клик).
   */
  function setup() {
    const overlay = document.getElementById('actor-overlay');
    const closeBtn = document.getElementById('actor-modal-close');

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
    });

    // Клик по актёру в блоке "В ролях" (делегирование на весь документ,
    // т.к. модалка фильма перерисовывается динамически)
    document.addEventListener('click', (e) => {
      const castItem = e.target.closest('.cast-item');
      if (castItem && castItem.dataset.personId) {
        open(castItem.dataset.personId);
        return;
      }

      // Клик по карточке фильма внутри карусели фильмографии актёра —
      // закрываем карточку актёра, открытие самого фильма произойдёт через
      // общий обработчик .movie-card в app.js на этом же событии клика.
      const filmographyCard = e.target.closest('#actor-filmography-track .movie-card');
      if (filmographyCard) {
        close();
      }
    });
  }

  return { open, close, setup };
})();
