
require('dotenv').config();

const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('./database');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));

// Файлы сайта лежат в корне репозитория.
app.use(express.static(__dirname, { index: false, dotfiles: 'ignore' }));

const categories = [
  ['Слоты', ['777 Slots', 'Полярные 7', 'Снежный джекпот', 'Ледяные фрукты', 'Аврора Spin', 'Кристалл Slots', 'Северный экспресс', 'Золотая метель', 'Фрост-барабаны', 'Ночь джекпота'], '🎰'],
  ['Колёса и призы', ['Колесо Фортуны', 'Колесо льда', 'Множитель Aurora', 'Золотой сектор', 'Колесо кристаллов', 'Северный приз', 'Фортуна 9', 'Снежный сектор', 'Колесо удачи', 'VIP-вращение'], '🎡'],
  ['Аркады и точность', ['Frost Darts', 'Снежный бросок', 'Ледяной тир', 'Меткий полярник', 'Кристальный дартс', 'Попади в цель', 'Фрост-мишень', 'Снежный снайпер', 'Точный удар', 'Арктический вызов'], '🎯'],
  ['Сокровища и коллекции', ['Ледяное сокровище', 'Сундук авроры', 'Затерянный артефакт', 'Ледяная шахта', 'Алмазный поиск', 'Секретный сейф', 'Золотая пещера', 'Коллекция реликвий', 'Тайник полярника', 'Хранилище льда'], '💎'],
  ['Испытания', ['Ледяной вызов', 'Реакция метели', 'Быстрый клик', 'Ледяной спринт', 'Вызов 30 секунд', 'Проверка реакции', 'Снежный рывок', 'Фрост-комбо', 'Турбо-раунд', 'Испытание авроры'], '⚡'],
  ['Головоломки', ['Кристальный пазл', 'Ледяной лабиринт', 'Три кристалла', 'Снежный код', 'Полярные пазлы', 'Собери аврору', 'Кристальная сетка', 'Логика льда', 'Зимний шифр', 'Северная загадка'], '🧩'],
  ['Карточные игры', ['Северный покер', 'Фрост-блэкджек', 'Полярная раздача', 'Кристальные карты', 'Северная дуэль', 'Туз метели', 'Карточный вызов', 'Ледяная рука', 'Золотая раздача', 'Аврора Cards'], '🂡'],
  ['Кости и настольные', ['Кости вьюги', 'Полярные кости', 'Ледяная гонка', 'Фрост-кубики', 'Северная доска', 'Маршрут авроры', 'Зимний бросок', 'Кубик удачи', 'Кристальный путь', 'Снежная партия'], '🎲'],
  ['Гонки', ['Полярная гонка', 'Арктик-рейс', 'Снегоходы', 'Полярный дрифт', 'Ледяной болид', 'Северный маршрут', 'Фрост-ралли', 'Аврора Racing', 'Снежная трасса', 'Турбо-метель'], '🏁'],
  ['Секретные события', ['Снежный подарок', 'Полночная аврора', 'Тайна снеговика', 'Подарок хранителя', 'Секретный проход', 'Зимняя охота', 'Скрытый сундук', 'Фрост-фестиваль', 'Тайный портал', 'Событие 777'], '🎁']
];

const games = categories.flatMap((category, ci) =>
  category[1].map((title, i) => ({
    id: `g${ci + 1}-${i + 1}`,
    title,
    category: category[0],
    icon: i === 0 ? category[2] : ['✨', '❄️', '💠', '🌌', '🪙', '🧊', '⭐', '🔥', '🎁', '🏆'][(ci + i) % 10],
    cost: [50, 50, 25, 20, 15, 10, 15, 10, 20, 0][ci] + (i % 3) * 5,
    description: `Демо-режим категории «${category[0]}». Испытай механику и зарабатывай XP.`
  }))
);

function getPlayer(req) {
  const id = Number(req.get('x-player-id'));

  if (Number.isInteger(id) && id > 0) {
    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (player) return player;
  }

  const nickname = 'Игрок-' + crypto.randomBytes(2).toString('hex').toUpperCase();
  const result = db.prepare('INSERT INTO players(nickname) VALUES(?)').run(nickname);

  return db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid);
}

function publicPlayer(player) {
  return {
    id: player.id,
    nickname: player.nickname,
    xp: player.xp,
    coins: player.coins,
    level: player.level,
    createdAt: player.created_at
  };
}

function updateLevel(id) {
  const player = db.prepare('SELECT xp FROM players WHERE id = ?').get(id);
  if (player) {
    db.prepare('UPDATE players SET level = ? WHERE id = ?')
      .run(Math.floor(player.xp / 500) + 1, id);
  }
}

function sendPlayer(res, playerId, message, extra = {}) {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
  return res.json({ player: publicPlayer(player), message, ...extra });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, version: '2.1.0' });
});

// Games catalog
app.get('/api/games', (req, res) => {
  res.json({ games });
});

// Current player
app.get('/api/me', (req, res) => {
  const player = getPlayer(req);
  res.set('X-Player-Id', String(player.id));
  res.json({ player: publicPlayer(player) });
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = db.prepare(`
    SELECT id, nickname, xp, coins, level
    FROM players
    WHERE is_banned = 0
    ORDER BY xp DESC
    LIMIT 50
  `).all();

  res.json({ leaderboard });
});

// Daily reward
app.post('/api/daily', (req, res) => {
  const player = getPlayer(req);
  const today = new Date().toISOString().slice(0, 10);

  if (player.last_daily === today) {
    return res.status(409).json({ error: 'Ежедневный подарок уже получен сегодня.' });
  }

  db.prepare(`
    UPDATE players
    SET xp = xp + 100, coins = coins + 50, last_daily = ?
    WHERE id = ?
  `).run(today, player.id);

  updateLevel(player.id);

  return sendPlayer(res, player.id, 'Получено +100 XP и +50 коинов!');
});

// Promo code activation
app.post('/api/promo', (req, res) => {
  const player = getPlayer(req);
  const code = String(req.body?.code || '').trim().toUpperCase();

  if (!/^[A-Z0-9_-]{1,40}$/.test(code)) {
    return res.status(400).json({ error: 'Проверь промокод.' });
  }

  const promo = db.prepare(
    'SELECT * FROM promos WHERE code = ? AND active = 1'
  ).get(code);

  if (!promo || promo.uses >= promo.max_uses) {
    return res.status(404).json({
      error: 'Промокод не найден или лимит активаций исчерпан.'
    });
  }

  if (db.prepare(
    'SELECT 1 FROM redemptions WHERE player_id = ? AND code = ?'
  ).get(player.id, code)) {
    return res.status(409).json({ error: 'Ты уже активировал этот промокод.' });
  }

  try {
    db.transaction(() => {
      // Проверяем лимит повторно внутри транзакции.
      const current = db.prepare(
        'SELECT * FROM promos WHERE code = ? AND active = 1'
      ).get(code);

      if (!current || current.uses >= current.max_uses) {
        throw new Error('PROMO_EXHAUSTED');
      }

      db.prepare('INSERT INTO redemptions(player_id, code) VALUES(?, ?)')
        .run(player.id, code);

      db.prepare('UPDATE promos SET uses = uses + 1 WHERE code = ?')
        .run(code);

      db.prepare(`
        UPDATE players SET xp = xp + ?, coins = coins + ? WHERE id = ?
      `).run(current.xp, current.coins, player.id);
    })();
  } catch (error) {
    if (error.message === 'PROMO_EXHAUSTED') {
      return res.status(404).json({
        error: 'Промокод не найден или лимит активаций исчерпан.'
      });
    }

    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
        error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Ты уже активировал этот промокод.' });
    }

    console.error('Promo activation error:', error);
    return res.status(500).json({ error: 'Не удалось активировать промокод.' });
  }

  updateLevel(player.id);

  const updatedPromo = db.prepare('SELECT xp, coins FROM promos WHERE code = ?').get(code);

  return sendPlayer(
    res,
    player.id,
    `Промокод активирован: +${updatedPromo.xp} XP, +${updatedPromo.coins} коинов.`
  );
});

// Demo game round
app.post('/api/play', (req, res) => {
  const player = getPlayer(req);
  const game = games.find(item => item.id === req.body?.gameId);

  if (player.is_banned) {
    return res.status(403).json({ error: 'Аккаунт ограничен.' });
  }

  if (!game) {
    return res.status(400).json({ error: 'Неизвестная игра.' });
  }

  if (player.coins < game.cost) {
    return res.status(400).json({
      error: `Нужно ${game.cost} коинов для запуска.`
    });
  }

  const won = crypto.randomInt(0, 100) < 38;
  const xp = won ? 15 : 3;
  const prize = won ? Math.max(5, Math.floor(game.cost * 1.5)) : 0;

  db.transaction(() => {
    db.prepare(`
      UPDATE players SET coins = coins - ? + ?, xp = xp + ? WHERE id = ?
    `).run(game.cost, prize, xp, player.id);

    db.prepare(`
      INSERT INTO history(player_id, game_id, result, xp_delta, coins_delta)
      VALUES(?, ?, ?, ?, ?)
    `).run(player.id, game.id, won ? 'win' : 'try', xp, prize - game.cost);
  })();

  updateLevel(player.id);

  return sendPlayer(
    res,
    player.id,
    won
      ? `Удача! +${xp} XP и ${prize - game.cost} коинов с учётом ставки.`
      : `Раунд завершён: +${xp} XP.`,
    { won, xpDelta: xp, coinsDelta: prize - game.cost }
  );
});

// Studio API authentication.
// Set ADMIN_IDS in Render environment variables.
function admin(req, res, next) {
  const ids = (process.env.ADMIN_IDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  const suppliedId = String(req.get('x-admin-id') || '');

  if (!ids.length || !ids.includes(suppliedId)) {
    return res.status(403).json({ error: 'Доступ запрещён.' });
  }

  next();
}

app.get('/api/studio/overview', admin, (req, res) => {
  const users = db.prepare('SELECT COUNT(*) AS n FROM players').get().n;
  const totals = db.prepare(`
    SELECT COALESCE(SUM(xp), 0) AS xp,
           COALESCE(SUM(coins), 0) AS coins
    FROM players
  `).get();
  const activePromos = db.prepare(
    'SELECT COUNT(*) AS n FROM promos WHERE active = 1'
  ).get().n;

  res.json({ users, xp: totals.xp, coins: totals.coins, activePromos });
});

app.get('/api/studio/users', admin, (req, res) => {
  const users = db.prepare(`
    SELECT id, nickname, xp, coins, level, is_banned, created_at
    FROM players
    ORDER BY id DESC
    LIMIT 200
  `).all();

  res.json({ users });
});

app.post('/api/studio/user/:id/ban', admin, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Некорректный ID пользователя.' });
  }

  const result = db.prepare(
    'UPDATE players SET is_banned = ? WHERE id = ?'
  ).run(req.body?.banned ? 1 : 0, id);

  if (!result.changes) {
    return res.status(404).json({ error: 'Пользователь не найден.' });
  }

  return res.json({ ok: true });
});

// Serve pages from the repository root.
app.get('/studio', (req, res) => {
  res.sendFile(path.join(__dirname, 'studio.html'), error => {
    if (error && !res.headersSent) {
      res.status(404).send('Файл studio.html пока не загружен в репозиторий.');
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// JSON error for unknown API routes.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API-маршрут не найден.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`XiroCasino running on port ${PORT}`);
});
