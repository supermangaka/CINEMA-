/*api.js — обёртка над TMDb API*/

const API = (() => {

  async function request(endpoint, params = {}) {
    const url = new URL(CONFIG.TMDB_BASE_URL + endpoint);
    url.searchParams.set('language', CONFIG.LANGUAGE);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${CONFIG.TMDB_TOKEN}`,
          'Content-Type': 'application/json;charset=utf-8',
        },
      });

      if (!response.ok) {
        throw new Error(`TMDb API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[API] Ошибка запроса к ${endpoint}:`, error);
      throw error;
    }
  }

  return {
    /** Трендовые фильмы/сериалы за день или неделю */
    getTrending(mediaType = 'all', timeWindow = 'week') {
      return request(`/trending/${mediaType}/${timeWindow}`);
    },

    /** Популярное */
    getPopular(mediaType = 'movie', page = 1) {
      return request(`/${mediaType}/popular`, { page });
    },

    /** Новинки: для фильмов — now_playing, для сериалов — on_the_air */
    getNowPlaying(mediaType = 'movie', page = 1) {
      const endpoint = mediaType === 'tv' ? '/tv/on_the_air' : '/movie/now_playing';
      return request(endpoint, { page });
    },

    /** Топ рейтинга */
    getTopRated(mediaType = 'movie', page = 1) {
      return request(`/${mediaType}/top_rated`, { page });
    },

    /** Список жанров */
    getGenres(mediaType = 'movie') {
      return request(`/genre/${mediaType}/list`);
    },

    /** Discover — фильтрация по жанру/году/рейтингу и сортировка */
    discover(mediaType = 'movie', filters = {}, page = 1) {
      // У TMDb поле сортировки "по дате выхода" называется по-разному
      // для фильмов (primary_release_date) и сериалов (first_air_date)
      let sortBy = filters.sort || 'popularity.desc';
      if (sortBy === 'primary_release_date.desc' && mediaType === 'tv') {
        sortBy = 'first_air_date.desc';
      }

      const params = { page, sort_by: sortBy };
      if (filters.genre) params.with_genres = filters.genre;
      if (filters.rating) params['vote_average.gte'] = filters.rating;
      if (filters.year) {
        params[mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year'] = filters.year;
      }
      // Мультфильмы — жанр Animation (16), явное ограничение
      if (mediaType === 'animation') {
        params.with_genres = filters.genre ? `${filters.genre},16` : '16';
        return request('/discover/movie', params);
      }
      return request(`/discover/${mediaType}`, params);
    },

    /** Живой поиск по названию (мультисёрч: фильмы + сериалы) */
    search(query, page = 1) {
      return request('/search/multi', { query, page, include_adult: false });
    },

    /** Полная информация о фильме/сериале */
    getDetails(id, mediaType = 'movie') {
      return request(`/${mediaType}/${id}`, { append_to_response: 'credits,videos,external_ids' });
    },

    /** Данные персоны (актёра/режиссёра) */
    getPersonDetails(personId) {
      return request(`/person/${personId}`);
    },

    /** Фильмография персоны (кино + сериалы) */
    getPersonCombinedCredits(personId) {
      return request(`/person/${personId}/combined_credits`);
    },
  };
})();
