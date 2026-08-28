/* ==========================================================================
   auth.js — клиентская авторизация (демонстрационная, без бэкенда)
   ==========================================================================
   Хранит "пользователей" и текущую сессию в localStorage браузера.
   Это НЕ полноценная система безопасности (пароли не хешируются
   криптографически стойким способом) — подходит для портфолио/прототипа,
   где нет отдельного backend/БД. Для продакшена нужен настоящий сервер
   с хешированием паролей (bcrypt/argon2) и HTTP-only сессионными cookie.
   ========================================================================== */

const Auth = (() => {
  const USERS_KEY = 'cinema_plus_users';
  const SESSION_KEY = 'cinema_plus_session';
  const MIN_PASSWORD_LENGTH = 6;

  /** Готовые аватарки-пресеты (эмодзи) на выбор в профиле */
  const PRESET_AVATARS = ['🎬', '🍿', '👾', '🤖', '🦸', '🧙', '🐱', '🐧', '🦊', '👻', '🐉', '🎭'];

  /* ---------------- Валидация ---------------- */
  /** Простая, но надёжная проверка формата email (RFC-облегчённая версия) */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
  }

  function isValidPassword(password) {
    return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
  }

  /** Генерирует стабильный HEX-цвет аватара на основе email (просто и детерминированно) */
  function generateAvatarColor(seed) {
    const palette = ['#e50914', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return palette[hash % palette.length];
  }

  /**
   * Валидирует данные формы входа.
   * @returns {{valid: boolean, errors: Object<string,string>}}
   */
  function validateLogin({ email, password }) {
    const errors = {};
    if (!email || !email.trim()) {
      errors.email = 'Введите email.';
    } else if (!isValidEmail(email)) {
      errors.email = 'Некорректный формат email.';
    }
    if (!password) {
      errors.password = 'Введите пароль.';
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }

  /**
   * Валидирует данные формы регистрации.
   * @returns {{valid: boolean, errors: Object<string,string>}}
   */
  function validateRegister({ name, email, password, passwordConfirm }) {
    const errors = {};

    if (!name || !name.trim()) {
      errors.name = 'Введите имя.';
    } else if (name.trim().length < 2) {
      errors.name = 'Имя должно содержать минимум 2 символа.';
    }

    if (!email || !email.trim()) {
      errors.email = 'Введите email.';
    } else if (!isValidEmail(email)) {
      errors.email = 'Некорректный формат email.';
    }

    if (!password) {
      errors.password = 'Введите пароль.';
    } else if (!isValidPassword(password)) {
      errors.password = `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов.`;
    }

    if (!passwordConfirm) {
      errors.passwordConfirm = 'Повторите пароль.';
    } else if (password && passwordConfirm !== password) {
      errors.passwordConfirm = 'Пароли не совпадают.';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  /**
   * Валидирует изменение имени в профиле.
   * @returns {{valid: boolean, errors: Object<string,string>}}
   */
  function validateNameChange(name) {
    const errors = {};
    if (!name || !name.trim()) {
      errors.name = 'Введите имя.';
    } else if (name.trim().length < 2) {
      errors.name = 'Имя должно содержать минимум 2 символа.';
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }

  /**
   * Валидирует смену пароля в профиле.
   * @returns {{valid: boolean, errors: Object<string,string>}}
   */
  function validatePasswordChange({ currentPassword, newPassword, newPasswordConfirm }) {
    const errors = {};

    if (!currentPassword) {
      errors.currentPassword = 'Введите текущий пароль.';
    }

    if (!newPassword) {
      errors.newPassword = 'Введите новый пароль.';
    } else if (!isValidPassword(newPassword)) {
      errors.newPassword = `Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов.`;
    }

    if (!newPasswordConfirm) {
      errors.newPasswordConfirm = 'Повторите новый пароль.';
    } else if (newPassword && newPasswordConfirm !== newPassword) {
      errors.newPasswordConfirm = 'Пароли не совпадают.';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  /* ---------------- Хранилище пользователей ---------------- */
  function getUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error('[Auth] Не удалось прочитать пользователей:', error);
      return [];
    }
  }

  function saveUsers(users) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (error) {
      console.error('[Auth] Не удалось сохранить пользователей:', error);
    }
  }

  /** Простое необратимое хеширование пароля (демонстрационное, не для продакшена) */
  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------------- Регистрация ---------------- */
  async function register({ name, email, password }) {
    const users = getUsers();
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      throw new Error('Некорректный формат email.');
    }
    if (!isValidPassword(password)) {
      throw new Error(`Пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов.`);
    }
    if (users.some(u => u.email === normalizedEmail)) {
      throw new Error('Пользователь с таким email уже зарегистрирован.');
    }

    const passwordHash = await hashPassword(password);
    const user = {
      id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      avatarColor: generateAvatarColor(normalizedEmail),
      createdAt: Date.now(),
    };

    users.push(user);
    saveUsers(users);
    setSession(user);
    return publicUser(user);
  }

  /* ---------------- Вход ---------------- */
  async function login({ email, password }) {
    const users = getUsers();
    const normalizedEmail = email.trim().toLowerCase();
    const user = users.find(u => u.email === normalizedEmail);

    if (!user) {
      throw new Error('Пользователь с таким email не найден.');
    }

    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.passwordHash) {
      throw new Error('Неверный пароль.');
    }

    setSession(user);
    return publicUser(user);
  }

  /* ---------------- Редактирование профиля ---------------- */

  /** Изменяет отображаемое имя пользователя */
  function updateName(userId, newName) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error('Пользователь не найден.');

    const { valid, errors } = validateNameChange(newName);
    if (!valid) throw new Error(Object.values(errors)[0]);

    user.name = newName.trim();
    saveUsers(users);
    return publicUser(user);
  }

  /** Меняет пароль после проверки текущего */
  async function changePassword(userId, { currentPassword, newPassword }) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error('Пользователь не найден.');

    const currentHash = await hashPassword(currentPassword);
    if (currentHash !== user.passwordHash) {
      throw new Error('Текущий пароль указан неверно.');
    }
    if (!isValidPassword(newPassword)) {
      throw new Error(`Новый пароль должен содержать минимум ${MIN_PASSWORD_LENGTH} символов.`);
    }

    user.passwordHash = await hashPassword(newPassword);
    saveUsers(users);
    return publicUser(user);
  }

  /**
   * Меняет аватар пользователя.
   * @param {string} userId
   * @param {{type: 'preset'|'custom'|'default', value?: string}} avatar
   *   type='preset' → value содержит эмодзи из PRESET_AVATARS
   *   type='custom' → value содержит base64 dataURL загруженного (и сжатого) фото
   *   type='default' → сброс к цветному кружку с инициалом имени
   */
  function setAvatar(userId, { type, value }) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) throw new Error('Пользователь не найден.');

    user.avatarType = type;
    user.avatarValue = type === 'default' ? null : (value || null);
    saveUsers(users);
    return publicUser(user);
  }

  /* ---------------- Сессия ---------------- */
  function setSession(user) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, loggedInAt: Date.now() }));
    } catch (error) {
      console.error('[Auth] Не удалось сохранить сессию:', error);
    }
  }

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      const users = getUsers();
      const user = users.find(u => u.id === session.userId);
      return user ? publicUser(user) : null;
    } catch (error) {
      console.error('[Auth] Не удалось прочитать сессию:', error);
      return null;
    }
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isLoggedIn() {
    return getCurrentUser() !== null;
  }

  /** Убираем passwordHash из объекта, отдаваемого наружу */
  function publicUser(user) {
    const { passwordHash, ...safe } = user;
    return safe;
  }

  return {
    register, login, logout, getCurrentUser, isLoggedIn,
    validateLogin, validateRegister, validateNameChange, validatePasswordChange,
    isValidEmail, isValidPassword,
    updateName, changePassword, setAvatar,
    PRESET_AVATARS, MIN_PASSWORD_LENGTH,
  };
})();
