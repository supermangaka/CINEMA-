/*profile.js — история просмотров + рендер модального окна профиля*/

/* ---------------------------------------------------------------------
   History — хранение истории просмотров в localStorage.
   Ключ истории привязан к id текущего пользователя, поэтому у разных
   аккаунтов на одном устройстве истории не пересекаются.
   --------------------------------------------------------------------- */
const History = (() => {
  function storageKey(userId) {
    return `cinema_plus_history_${userId}`;
  }

  function getAll(userId) {
    if (!userId) return [];
    try {
      const raw = localStorage.getItem(storageKey(userId));
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error('[History] Не удалось прочитать историю:', error);
      return [];
    }
  }

  function saveAll(userId, list) {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(list));
    } catch (error) {
      console.error('[History] Не удалось сохранить историю:', error);
    }
  }

  /** Добавляет запись в историю (или поднимает наверх, если уже там есть) */
  function add(userId, item) {
    if (!userId) return; // история ведётся только для авторизованных пользователей
    const list = getAll(userId);
    const filtered = list.filter(h => !(h.id === item.id && h.media_type === item.media_type));

    filtered.unshift({
      id: item.id,
      media_type: item.media_type,
      title: item.title || item.name,
      poster_path: item.poster_path,
      vote_average: item.vote_average,
      watchedAt: Date.now(),
    });

    // Ограничиваем историю последними 50 записями
    saveAll(userId, filtered.slice(0, 50));
  }

  function remove(userId, id, mediaType) {
    const list = getAll(userId).filter(h => !(h.id === id && h.media_type === mediaType));
    saveAll(userId, list);
  }

  function clear(userId) {
    saveAll(userId, []);
  }

  return { getAll, add, remove, clear };
})();

/* ---------------------------------------------------------------------
   Profile — рендер модального окна профиля
   (вкладки Избранное / История / Настройки)
   --------------------------------------------------------------------- */
const Profile = (() => {

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /**
   * Обновляет отображение аватара сразу во всех местах интерфейса
   * (аватар в шапке и аватар в модалке профиля), исходя из полей
   * user.avatarType / user.avatarValue / user.avatarColor.
   */
  function applyAvatar(user) {
    const targets = [document.getElementById('profile-avatar'), document.getElementById('profile-modal-avatar')];

    targets.forEach(el => {
      if (!el) return;
      el.innerHTML = '';

      if (user.avatarType === 'custom' && user.avatarValue) {
        el.style.backgroundColor = 'transparent';
        const img = document.createElement('img');
        img.src = user.avatarValue;
        img.alt = user.name || '';
        el.appendChild(img);
      } else if (user.avatarType === 'preset' && user.avatarValue) {
        el.style.backgroundColor = user.avatarColor || '';
        el.textContent = user.avatarValue;
      } else {
        el.style.backgroundColor = user.avatarColor || '';
        el.textContent = (user.name || '?').trim().charAt(0).toUpperCase();
      }
    });
  }

  /** Обновляет счётчики "в избранном" / "в истории" в шапке профиля */
  function updateStats(userId) {
    const favEl = document.getElementById('stat-favorites');
    const histEl = document.getElementById('stat-history');
    if (favEl) favEl.textContent = Favorites.getAll().length;
    if (histEl) histEl.textContent = userId ? History.getAll(userId).length : 0;
  }

  function render(user) {
    document.getElementById('profile-name').textContent = user.name;
    document.getElementById('profile-email').textContent = user.email;

    applyAvatar(user);
    updateStats(user.id);
    renderFavoritesPanel();
    renderHistoryPanel(user.id);
  }

  function renderFavoritesPanel() {
    const panel = document.getElementById('profile-favorites-panel');
    const favs = Favorites.getAll();

    if (favs.length === 0) {
      panel.innerHTML = `<p class="text-gray-400 col-span-full text-center py-14">Список избранного пуст.</p>`;
      return;
    }

    panel.innerHTML = favs.map(f => UI.movieCard({
      id: f.id, media_type: f.media_type, title: f.title, name: f.title,
      poster_path: f.poster_path, vote_average: f.vote_average, release_date: f.release_date,
    })).join('');
  }

  function renderHistoryPanel(userId) {
    const panel = document.getElementById('profile-history-panel');
    const history = History.getAll(userId);

    if (history.length === 0) {
      panel.innerHTML = `<p class="text-gray-400 text-center py-14">История просмотров пуста. Она заполняется автоматически, когда вы запускаете плеер в карточке фильма или сериала.</p>`;
      return;
    }

    panel.innerHTML = history.map(h => `
      <div class="history-card" data-id="${h.id}" data-media-type="${h.media_type}">
        <img src="${UI.posterUrl(h.poster_path)}" alt="${UI.escapeHtml(h.title)}"
             onerror="this.src='${CONFIG.PLACEHOLDER_POSTER}'">
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm truncate">${UI.escapeHtml(h.title)}</p>
          <p class="text-xs text-gray-400 mt-1">Просмотрено ${formatDate(h.watchedAt)}</p>
        </div>
        <button class="history-remove-btn shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 hover:scale-105 active:scale-95 transition-all duration-300"
                data-remove-id="${h.id}" data-remove-type="${h.media_type}" aria-label="Удалить из истории">
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `).join('');
  }

  /*Вкладки профиля (Избранное / История / Настройки)*/
  function setupTabs() {
    document.querySelectorAll('[data-profile-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-profile-tab]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const target = tab.dataset.profileTab; // favorites | history | settings
        const favoritesPanel = document.getElementById('profile-favorites-panel');
        const historyPanel = document.getElementById('profile-history-panel');
        const settingsPanel = document.getElementById('profile-settings-panel');

        favoritesPanel.classList.toggle('hidden', target !== 'favorites');
        favoritesPanel.classList.toggle('content-grid', target === 'favorites');
        historyPanel.classList.toggle('hidden', target !== 'history');
        historyPanel.classList.toggle('flex', target === 'history');
        settingsPanel.classList.toggle('hidden', target !== 'settings');
        settingsPanel.classList.toggle('flex', target === 'settings');

        if (target === 'settings') {
          const user = Auth.getCurrentUser();
          if (user) renderSettingsPanel(user);
        }
      });
    });

    // Клик по аватару в шапке профиля — быстрый переход к вкладке "Настройки"
    document.getElementById('profile-avatar-btn')?.addEventListener('click', () => {
      document.querySelector('[data-profile-tab="settings"]')?.click();
    });

    // Делегированный обработчик удаления из истории
    document.getElementById('profile-history-panel').addEventListener('click', (e) => {
      const btn = e.target.closest('.history-remove-btn');
      if (!btn) return;
      const user = Auth.getCurrentUser();
      if (!user) return;
      History.remove(user.id, Number(btn.dataset.removeId), btn.dataset.removeType);
      renderHistoryPanel(user.id);
      updateStats(user.id);
    });
  }

  /*Вкладка "Настройки": аватар, имя, пароль, очистка истории*/

  function renderSettingsPanel(user) {
    document.getElementById('edit-name-input').value = user.name;
    renderAvatarPresetGrid(user);
  }

  function renderAvatarPresetGrid(user) {
    const grid = document.getElementById('avatar-preset-grid');
    grid.innerHTML = Auth.PRESET_AVATARS.map(emoji => {
      const isActive = user.avatarType === 'preset' && user.avatarValue === emoji;
      return `<button type="button" class="avatar-preset-btn ${isActive ? 'active' : ''}" data-preset="${emoji}">${emoji}</button>`;
    }).join('');
  }

  /** Показывает ошибки под конкретными полями формы по карте { fieldKey: inputId } */
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

  /**
   * Читает выбранный файл изображения, обрезает его по центру в квадрат
   * и сжимает через canvas — чтобы base64 не раздувал localStorage.
   * @returns {Promise<string>} data URL (JPEG, 256×256)
   */
  function readAndResizeImage(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Пожалуйста, выберите файл изображения.'));
        return;
      }
      const MAX_SIZE_MB = 8;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        reject(new Error(`Файл слишком большой (максимум ${MAX_SIZE_MB} МБ).`));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Не удалось загрузить изображение.'));
        img.onload = () => {
          const TARGET = 256;
          const canvas = document.createElement('canvas');
          canvas.width = TARGET;
          canvas.height = TARGET;
          const ctx = canvas.getContext('2d');

          // Кроп по центру в квадрат перед масштабированием, чтобы фото не искажалось
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          ctx.drawImage(img, sx, sy, side, side, 0, 0, TARGET, TARGET);

          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function setupSettingsTab() {
    const nameForm = document.getElementById('edit-name-form');
    const passwordForm = document.getElementById('edit-password-form');
    const passwordError = document.getElementById('edit-password-error');
    const avatarGrid = document.getElementById('avatar-preset-grid');
    const uploadBtn = document.getElementById('avatar-upload-btn');
    const fileInput = document.getElementById('avatar-file-input');
    const resetBtn = document.getElementById('avatar-reset-btn');
    const uploadError = document.getElementById('avatar-upload-error');

    // Снимаем "invalid" с поля при вводе
    [nameForm, passwordForm].forEach(form => {
      form.querySelectorAll('.auth-input').forEach(input => {
        input.addEventListener('input', () => {
          input.classList.remove('invalid');
          form.querySelector(`[data-error-for="${input.id}"]`)?.classList.add('hidden');
        });
      });
    });

    /*Аватар: пресеты*/
    avatarGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.avatar-preset-btn');
      if (!btn) return;
      const user = Auth.getCurrentUser();
      if (!user) return;

      const updated = Auth.setAvatar(user.id, { type: 'preset', value: btn.dataset.preset });
      applyAvatar(updated);
      renderAvatarPresetGrid(updated);
      UI.showToast('Аватар обновлён');
    });

    /*Аватар: загрузка своего фото*/
    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      uploadError.classList.add('hidden');
      if (!file) return;

      try {
        const dataUrl = await readAndResizeImage(file);
        const user = Auth.getCurrentUser();
        if (!user) return;
        const updated = Auth.setAvatar(user.id, { type: 'custom', value: dataUrl });
        applyAvatar(updated);
        renderAvatarPresetGrid(updated);
        UI.showToast('Аватар обновлён');
      } catch (error) {
        uploadError.textContent = error.message;
        uploadError.classList.remove('hidden');
      } finally {
        e.target.value = ''; // чтобы можно было выбрать тот же файл повторно
      }
    });

    /*Аватар: сброс к инициалу*/
    resetBtn.addEventListener('click', () => {
      const user = Auth.getCurrentUser();
      if (!user) return;
      const updated = Auth.setAvatar(user.id, { type: 'default' });
      applyAvatar(updated);
      renderAvatarPresetGrid(updated);
      UI.showToast('Аватар сброшен');
    });

    /*Имя*/
    nameForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const user = Auth.getCurrentUser();
      if (!user) return;

      const name = document.getElementById('edit-name-input').value;
      const { valid, errors } = Auth.validateNameChange(name);
      if (!valid) {
        showFieldErrors(nameForm, { name: 'edit-name-input' }, errors);
        return;
      }

      try {
        const updated = Auth.updateName(user.id, name);
        document.getElementById('profile-name').textContent = updated.name;
        applyAvatar(updated); // инициал в аватаре мог измениться вместе с именем
        UI.showToast('Имя обновлено');
      } catch (error) {
        showFieldErrors(nameForm, { name: 'edit-name-input' }, { name: error.message });
      }
    });

    /*Пароль*/
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      passwordError.classList.add('hidden');
      const user = Auth.getCurrentUser();
      if (!user) return;

      const currentPassword = document.getElementById('edit-current-password').value;
      const newPassword = document.getElementById('edit-new-password').value;
      const newPasswordConfirm = document.getElementById('edit-new-password-confirm').value;

      const { valid, errors } = Auth.validatePasswordChange({ currentPassword, newPassword, newPasswordConfirm });
      if (!valid) {
        showFieldErrors(passwordForm, {
          currentPassword: 'edit-current-password',
          newPassword: 'edit-new-password',
          newPasswordConfirm: 'edit-new-password-confirm',
        }, errors);
        return;
      }

      try {
        await Auth.changePassword(user.id, { currentPassword, newPassword });
        passwordForm.reset();
        UI.showToast('Пароль изменён');
      } catch (error) {
        passwordError.textContent = error.message;
        passwordError.classList.remove('hidden');
      }
    });

    /*Очистка истории (с подтверждением)*/
    const clearZone = document.getElementById('clear-history-zone');
    const clearZoneDefaultHTML = clearZone.innerHTML;

    clearZone.addEventListener('click', (e) => {
      if (e.target.id === 'clear-history-btn') {
        clearZone.innerHTML = `
          <span class="text-sm text-gray-300">Удалить всю историю просмотров?</span>
          <button type="button" id="confirm-clear-history" class="text-sm font-bold text-red-400 hover:text-red-300 hover:scale-105 transition-all duration-300">Да, очистить</button>
          <button type="button" id="cancel-clear-history" class="text-sm text-gray-400 hover:text-white hover:scale-105 transition-all duration-300">Отмена</button>
        `;
      } else if (e.target.id === 'confirm-clear-history') {
        const user = Auth.getCurrentUser();
        if (user) {
          History.clear(user.id);
          renderHistoryPanel(user.id);
          updateStats(user.id);
          UI.showToast('История просмотров очищена');
        }
        clearZone.innerHTML = clearZoneDefaultHTML;
      } else if (e.target.id === 'cancel-clear-history') {
        clearZone.innerHTML = clearZoneDefaultHTML;
      }
    });
  }

  // Живое обновление счётчика избранного и вкладки "Избранное" в открытом
  // профиле, когда пользователь ставит/снимает ♥ где угодно в приложении.
  document.addEventListener('favorites-changed', () => {
    const overlay = document.getElementById('profile-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    const user = Auth.getCurrentUser();
    updateStats(user ? user.id : null);
    renderFavoritesPanel();
  });

  return { render, renderFavoritesPanel, renderHistoryPanel, setupTabs, setupSettingsTab, applyAvatar };
})();
