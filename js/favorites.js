/*favorites.js — управление списком "Избранное" через localStorage*/

const Favorites = (() => {
  const STORAGE_KEY = 'cinema_plus_favorites';

  function getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error('[Favorites] Не удалось прочитать localStorage:', error);
      return [];
    }
  }

  function saveAll(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (error) {
      console.error('[Favorites] Не удалось сохранить в localStorage:', error);
    }
  }

  function isFavorite(id, mediaType) {
    return getAll().some(item => item.id === id && item.media_type === mediaType);
  }

  function toggle(item) {
    const list = getAll();
    const idx = list.findIndex(f => f.id === item.id && f.media_type === item.media_type);

    if (idx >= 0) {
      list.splice(idx, 1);
      saveAll(list);
      return false; // удалено
    } else {
      list.unshift({
        id: item.id,
        media_type: item.media_type,
        title: item.title || item.name,
        poster_path: item.poster_path,
        vote_average: item.vote_average,
        release_date: item.release_date || item.first_air_date,
        addedAt: Date.now(),
      });
      saveAll(list);
      return true; // добавлено
    }
  }

  return { getAll, isFavorite, toggle };
})();
