/* ==========================================================================
   config.js — конфигурация приложения
   ==========================================================================
   Получить бесплатный API-ключ TMDb:
   1. Зарегистрируйтесь на https://www.themoviedb.org/signup
   2. Перейдите в Settings → API → Create → Developer
   3. Заполните форму (для портфолио/учебного проекта укажите "Personal / Education")
   4. Скопируйте "API Read Access Token" (v4 auth) — он и используется ниже.
   ========================================================================== */

const CONFIG = {
  // Вставьте сюда ваш TMDb API Read Access Token (v4)
  TMDB_TOKEN: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4NzgyNmFjODAwYjBiMGVhZTExMDYzZjFhYThlMzFjZCIsIm5iZiI6MTc4NzA1NDE0My4wNzYsInN1YiI6IjZhODQ0ODNmNDFkODAxMTk1NjExYTJjZSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.MmdbL5ORbSX1xoVa592dlpyyoxwr3MEF5eofJNNTXiA',

  TMDB_BASE_URL: 'https://api.themoviedb.org/3',

  // Базовые URL для изображений разных размеров
  IMG: {
    poster_sm: 'https://image.tmdb.org/t/p/w342',
    poster_lg: 'https://image.tmdb.org/t/p/w500',
    backdrop: 'https://image.tmdb.org/t/p/original',
    profile: 'https://image.tmdb.org/t/p/w185',
    profile_lg: 'https://image.tmdb.org/t/p/w300',
  },

  // Язык и регион ответа TMDb
  LANGUAGE: 'ru-RU',
  REGION: 'RU',

  // Заглушка для постеров без изображения
  PLACEHOLDER_POSTER: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="342" height="513" viewBox="0 0 342 513">
      <rect width="342" height="513" fill="#1e1e2d"/>
      <text x="50%" y="50%" fill="#4b4b5c" font-family="sans-serif" font-size="20" text-anchor="middle" dy=".3em">Нет постера</text>
    </svg>
  `),
};
