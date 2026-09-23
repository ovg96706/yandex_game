/* Локальная заглушка /sdk.js.
 * На сервере Яндекс Игр этот файл НЕ используется — платформа отдаёт свой SDK.
 *
 * По умолчанию YaGames намеренно не создаётся: игра работает в локальном режиме
 * (реклама недоступна, награды не выдаются).
 *
 * Проверка п. 2.14 (автоопределение языка) локально — добавьте ?lang=<код> к адресу:
 *   http://localhost:3000/?lang=tr
 * Тогда поднимается минимальный мок YaGames с environment.i18n.lang = "tr" — аналог
 * выпадающего списка языков в «SDK mocks ⚒️» debug-панели. В консоли браузера будет
 * видно, прочитала ли игра язык ДО вызова LoadingAPI.ready() (аналог индикатора 文).
 */
(function () {
  var lang = null;
  try { lang = new URLSearchParams(window.location.search).get("lang"); } catch (e) {}

  if (!lang) {
    console.info("[local] Yandex SDK stub: running without YaGames (add ?lang=en to mock i18n)");
    return;
  }

  var i18nReadAt = null;
  var startedAt = Date.now();
  var i18n = {};
  Object.defineProperty(i18n, "lang", {
    enumerable: true,
    get: function () {
      if (i18nReadAt === null) {
        i18nReadAt = Date.now() - startedAt;
        console.info("[local] I18N is used: environment.i18n.lang = " + JSON.stringify(lang) + " (after " + i18nReadAt + " ms)");
      }
      return lang;
    },
  });

  var sdk = {
    environment: { app: { id: "local" }, i18n: i18n, payload: undefined },
    features: {
      LoadingAPI: {
        ready: function () {
          var verdict = i18nReadAt === null
            ? "❌ I18N is NOT used — язык не прочитан до LoadingAPI.ready()"
            : "✅ I18N is used — язык прочитан за " + i18nReadAt + " ms до ready()";
          console.info("[local] LoadingAPI.ready() after " + (Date.now() - startedAt) + " ms. " + verdict);
        },
      },
      GameplayAPI: { start: function () {}, stop: function () {} },
    },
    getPlayer: function () { return Promise.reject(new Error("[local] mock: player unavailable")); },
    getLeaderboards: function () { return Promise.reject(new Error("[local] mock: leaderboards unavailable")); },
    // adv намеренно отсутствует: реклама в моке недоступна, награды не выдаются.
  };

  window.YaGames = {
    init: function () {
      console.info("[local] YaGames.init() mock, lang=" + JSON.stringify(lang));
      return Promise.resolve(sdk);
    },
  };
})();
