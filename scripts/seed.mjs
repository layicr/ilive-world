// 种子脚本：执行项目根 schema.sql（四表 + 内置 site_settings/site_seo_i18n 幂等种子），
// 再按 seq 幂等写入 60 场演唱会（zh-CN / en / zh-Hant 三语 *_i18n）、每场歌单与每场标签。
// 表字段严格以 schema.sql 为准，本脚本不做任何 DDL 增删改。
// Seed script: runs the root schema.sql (four tables + idempotent site_settings/site_seo_i18n seeds),
// then idempotently writes 60 concerts (trilingual zh-CN / en / zh-Hant *_i18n), each setlist and each set of tags by seq.
// Table columns strictly follow schema.sql; this script performs no DDL changes.
import { createClient } from '@libsql/client';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// ---------- 连接（与 server/utils/db.ts 同规则） · Connection (same rules as server/utils/db.ts) ----------
function toFileUrl(spec) {
  const abs = resolve(process.cwd(), spec.replace(/^file:/, ''));
  mkdirSync(dirname(abs), { recursive: true });
  return 'file:' + abs;
}
function connection() {
  const raw = (process.env.DATABASE_URL || '').trim();
  const auth = process.env.TURSO_AUTH_TOKEN;
  if (/^(libsql|https?):\/\//.test(raw)) return { url: raw, authToken: auth || undefined };
  return { url: toFileUrl(raw || 'data/planet.db') };
}

// ---------- 事务助手：连 Turso 云时把整段写入压成一次事务（逐条 await 在云端是每个往返一次 RTT）；
// 不支持交互式事务的客户端则降级为顺序执行，语义不变 ----------
// ---------- Transaction helper: on Turso cloud, collapse the whole write into one transaction (per-row await costs a round-trip each); clients without interactive transactions fall back to sequential execution, same semantics ----------
async function withTx(fn) {
  let tx = null;
  try { tx = await db.transaction('write'); } catch { tx = null; }
  if (!tx) return fn(db);
  try {
    const r = await fn(tx);
    await tx.commit();
    return r;
  } catch (e) {
    try { await tx.rollback(); } catch { /* 事务已失效，原始错误才是关键 · txn already voided; the original error is the real one */ }
    throw e;
  } finally {
    try { tx.close(); } catch { /* ignore */ }
  }
}

// ---------- 三语 JSON 助手 · Trilingual JSON helper ----------
const I = (zh, en, hant) => JSON.stringify({ 'zh-CN': zh, 'en': en, 'zh-Hant': hant });

// ---------- 文案数据池 · Copy data pools ----------
const NAMES_ZH = ['星光草莓音乐节', '蜜糖月光演唱会', '云朵泡泡音乐节', '彩虹糖音乐节', '蒲公英之歌演唱会',
  '流星雨音乐节', '樱桃布丁音乐节', '微风糖果演唱会', '萤火虫之夜音乐节', '柠檬苏打音乐节',
  '羊毛卷卷音乐会', '薄荷汽水音乐节', '彩虹尾巴演唱会', '花田月光音乐节', '小铃铛音乐会',
  '奶油泡芙音乐节', '枫叶飘扬演唱会', '星星点点音乐节', '蘑菇伞下音乐会', '月亮船演唱会',
  '草莓汽水音乐节', '棉花糖云演唱会', '四叶草音乐节', '蜂蜜松饼演唱会', '风车之歌音乐节',
  '露珠清晨音乐会', '葡萄汽水音乐节', '枫糖布丁演唱会', '蒲公英舞会', '月光秋千音乐会',
  '海盐蓝调音乐节', '橘子汽水演唱会', '樱花纷飞的音乐会', '星尘漫游音乐节', '奶油蛋糕演唱会', '极光之夜音乐节',
  '森林电台音乐会', '海浪节拍演唱会', '棉花糖云朵音乐节', '银河列车演唱会', '午后红茶音乐会', '萤火虫之夏音乐节',
  '纸飞机演唱会', '薄荷绿音乐节', '落日飞车演唱会', '雪花飘飘音乐会', '糖果盒音乐节', '星空露营演唱会',
  '泡泡糖音乐节', '风铃草音乐会', '蜜桃乌龙演唱会', '北极光音乐节', '夏日蝉鸣演唱会', '星月神话音乐节',
  '抹茶时光音乐会', '万花筒演唱会', '蓝调雨巷音乐节', '萤火之森演唱会', '天空之城音乐节', '甜蜜蜜演唱会'];
const NAMES_EN = ['Starlight Strawberry Fest', 'Honey Moonlight Concert', 'Cloud Bubble Fest', 'Rainbow Candy Fest', 'Dandelion Song Concert',
  'Meteor Shower Fest', 'Cherry Pudding Fest', 'Breeze Candy Concert', 'Firefly Night Fest', 'Lemon Soda Fest',
  'Woolly Curl Recital', 'Mint Soda Fest', 'Rainbow Tail Concert', 'Flowerfield Moonlight Fest', 'Little Bell Recital',
  'Cream Puff Fest', 'Maple Drift Concert', 'Twinkle Stars Fest', 'Under the Mushroom Recital', 'Moon Boat Concert',
  'Strawberry Soda Fest', 'Cotton Candy Cloud Concert', 'Four Leaf Clover Fest', 'Honey Pancake Concert', 'Windmill Song Fest',
  'Morning Dew Recital', 'Grape Soda Fest', 'Maple Pudding Concert', 'Dandelion Ball', 'Moonlight Swing Recital',
  'Sea Salt Blues Fest', 'Orange Soda Concert', 'Cherry Blossom Recital', 'Stardust Drift Fest', 'Cream Cake Concert', 'Aurora Night Fest',
  'Forest Radio Recital', 'Wavebeat Concert', 'Marshmallow Cloud Fest', 'Galaxy Train Concert', 'Afternoon Tea Recital', 'Firefly Summer Fest',
  'Paper Plane Concert', 'Mint Green Fest', 'Sunset Flyer Concert', 'Snowfall Recital', 'Candy Box Fest', 'Starry Camp Concert',
  'Bubblegum Fest', 'Bluebell Recital', 'Peach Oolong Concert', 'Northern Light Fest', 'Summer Cicada Concert', 'Starmoon Myth Fest',
  'Matcha Time Recital', 'Kaleidoscope Concert', 'Blues Alley Fest', 'Firefly Woods Concert', 'Castle in the Sky Fest', 'Sweet Honey Concert'];
const NAMES_HANT = ['星光草莓音樂節', '蜜糖月光演唱會', '雲朵泡泡音樂節', '彩虹糖音樂節', '蒲公英之歌演唱會',
  '流星雨音樂節', '櫻桃布丁音樂節', '微風糖果演唱會', '螢火蟲之夜音樂節', '檸檬蘇打音樂節',
  '羊毛捲捲音樂會', '薄荷汽水音樂節', '彩虹尾巴演唱會', '花田月光音樂節', '小鈴鐺音樂會',
  '奶油泡芙音樂節', '楓葉飄揚演唱會', '星星點點音樂節', '蘑菇傘下音樂會', '月亮船演唱會',
  '草莓汽水音樂節', '棉花糖雲演唱會', '四葉草音樂節', '蜂蜜鬆餅演唱會', '風車之歌音樂節',
  '露珠清晨音樂會', '葡萄汽水音樂節', '楓糖布丁演唱會', '蒲公英舞會', '月光鞦韆音樂會',
  '海鹽藍調音樂節', '橘子汽水演唱會', '櫻花紛飛的音樂會', '星塵漫遊音樂節', '奶油蛋糕演唱會', '極光之夜音樂節',
  '森林電台音樂會', '海浪節拍演唱會', '棉花糖雲音樂節', '銀河列車演唱會', '午後紅茶音樂會', '螢火蟲之夏音樂節',
  '紙飛機演唱會', '薄荷綠音樂節', '落日飛車演唱會', '雪花飄飄音樂會', '糖果盒音樂節', '星空露營演唱會',
  '泡泡糖音樂節', '風鈴草音樂會', '蜜桃烏龍演唱會', '北極光音樂節', '夏日蟬鳴演唱會', '星月神話音樂節',
  '抹茶時光音樂會', '萬花筒演唱會', '藍調雨巷音樂節', '螢火之森演唱會', '天空之城音樂節', '甜蜜蜜演唱會'];

const ARTISTS_ZH = ['莓莓', '泡泡', '闪闪', '团团', '糯米', '布丁', '云朵', '星星', '铃铛', '芝士',
  '桃子', '薄荷', '奶糖', '小菊', '露珠', '麦芽', '雪球', '橘子', '小紫', '阿满',
  '果冻', '团子', '栗子', '糖糖', '米糕', '花卷', '布蕾', '豆豆', '奶昔', '汤圆',
  '糖霜', '阿蓝', '小橘', '米粒', '麦冬', '果酱', '阿茶', '小樱', '雪媚', '星儿',
  '月亮', '阿柚', '泡芙', '奶芙', '小满', '青柠', '阿澄', '米糖', '小葵', '阿栗',
  '糖雪', '海苔', '阿澈', '小舟', '星野', '暖暖', '知了', '阿洛', '晚风', '初雪'];
const ARTISTS_EN = ['Berry', 'Bubble', 'Twinkle', 'Tuan', 'Mochi', 'Pudding', 'Cloud', 'Star', 'Bells', 'Cheese',
  'Peach', 'Mint', 'Toffee', 'Daisy', 'Dew', 'Malt', 'Snowball', 'Tangerine', 'Violet', 'Manman',
  'Jelly', 'Dumpling', 'Chestnut', 'Candy', 'Ricecake', 'Roll', 'Brulee', 'Bean', 'Shake', 'Tangyuan',
  'Frosting', 'Blue', 'Mandarin', 'Grain', 'Barley', 'Jam', 'Tea', 'Sakura', 'Snowy', 'Stella',
  'Luna', 'Pomelo', 'Puff', 'Cream', 'Sunny', 'Lime', 'Clear', 'Toffee', 'Sunflower', 'Walnut',
  'Sugar', 'Nori', 'Rivulet', 'Boat', 'Starfield', 'Warm', 'Cicada', 'Loki', 'Dusk', 'Firstsnow'];
const ARTISTS_HANT = ['莓莓', '泡泡', '閃閃', '團團', '糯米', '布丁', '雲朵', '星星', '鈴鐺', '芝士',
  '桃子', '薄荷', '奶糖', '小菊', '露珠', '麥芽', '雪球', '橘子', '小紫', '阿滿',
  '果凍', '團子', '栗子', '糖糖', '米糕', '花卷', '布蕾', '豆豆', '奶昔', '湯圓',
  '糖霜', '阿藍', '小橘', '米粒', '麥冬', '果醬', '阿茶', '小櫻', '雪媚', '星兒',
  '月亮', '阿柚', '泡芙', '奶芙', '小滿', '青檸', '阿澄', '米糖', '小葵', '阿栗',
  '糖雪', '海苔', '阿澈', '小舟', '星野', '暖暖', '知了', '阿洛', '晚風', '初雪'];

const GENRES_ZH = ['民谣', '泡泡糖流行', '电子', '爵士', '摇滚', '童谣', '原声吉他', '梦幻合成器', '圆舞曲'];
const GENRES_EN = ['Folk', 'Bubblegum Pop', 'Electronic', 'Jazz', 'Rock', 'Nursery Rhyme', 'Acoustic Guitar', 'Dream Synth', 'Waltz'];
const GENRES_HANT = ['民謠', '泡泡糖流行', '電子', '爵士', '搖滾', '童謠', '原聲吉他', '夢幻合成器', '圓舞曲'];

const CITIES = [
  ['上海', 'Shanghai', '上海'], ['北京', 'Beijing', '北京'], ['广州', 'Guangzhou', '廣州'],
  ['成都', 'Chengdu', '成都'], ['杭州', 'Hangzhou', '杭州'], ['西安', "Xi'an", '西安'],
  ['重庆', 'Chongqing', '重慶'], ['武汉', 'Wuhan', '武漢']
];
const VENUES = [
  ['星光体育馆', 'Starlight Arena', '星光體育館'], ['玫瑰音乐厅', 'Rose Concert Hall', '玫瑰音樂廳'],
  ['云端剧场', 'Cloud Theater', '雲劇場'], ['月桂文化中心', 'Laurus Cultural Center', '月桂文化中心'],
  ['彩虹演艺厅', 'Rainbow Playhouse', '彩虹演藝廳']
];
const SEATS = [
  ['VIP 区 A 排', 'VIP Row A', 'VIP 區 A 排'], ['内场 B 区', 'Floor B', '內場 B 區'],
  ['看台 C 区', 'Balcony C', '看台 C 區'], ['山顶票', 'Upper Tier', '山頂票']
];

const TAGS_ZH = ['现场乐队', '全场大合唱', '安可加唱', '首次巡演', '户外限定', '嘉宾彩蛋', '灯光秀', '不插电'];
const TAGS_EN = ['Live Band', 'Sing-along', 'Encore', 'First Tour', 'Open-air', 'Guest Cameo', 'Light Show', 'Unplugged'];
const TAGS_HANT = ['現場樂隊', '全場大合唱', '安可加唱', '首次巡演', '戶外限定', '嘉賓彩蛋', '燈光秀', '不插電'];

const SONGS_ZH = ['小星星', '棉花糖', '晚风', '梦游仙境', '糖果雨', '月光下', '气泡水', '蒲公英', '彩虹桥', '奶油纪', '午后', '星海',
  '萤火虫', '纸飞机', '泡泡糖', '橘子汽水', '夏日蝉鸣', '雪绒花', '春天里', '海浪', '森林曲', '星空下', '落叶', '童话',
  '气球', '冰淇淋', '木马', '风筝', '秋千', '捉迷藏', '纸船', '玻璃珠', '麦田', '风铃', '热气球', '银河', '极光', '流星', '日出', '彩虹色'];
const SONGS_EN = ['Little Star', 'Marshmallow', 'Night Breeze', 'Dreamland', 'Candy Rain', 'Under the Moon', 'Sparkling Water', 'Dandelion', 'Rainbow Bridge', 'Cream Diary', 'Afternoon', 'Star Sea',
  'Fireflies', 'Paper Plane', 'Bubblegum', 'Orange Soda', 'Summer Cicada', 'Edelweiss', 'In Spring', 'Sea Waves', 'Forest Song', 'Under the Stars', 'Fallen Leaves', 'Fairy Tale',
  'Balloon', 'Ice Cream', 'Carousel', 'Kite', 'Swing', 'Hide and Seek', 'Paper Boat', 'Marble', 'Wheat Field', 'Wind Chime', 'Hot Air Balloon', 'Galaxy', 'Aurora', 'Shooting Star', 'Sunrise', 'Rainbow Hue'];
const SONGS_HANT = ['小星星', '棉花糖', '晚風', '夢遊仙境', '糖果雨', '月光下', '氣泡水', '蒲公英', '彩虹橋', '奶油紀', '午後', '星海',
  '螢火蟲', '紙飛機', '泡泡糖', '橘子汽水', '夏日蟬鳴', '雪絨花', '春天裡', '海浪', '森林曲', '星空下', '落葉', '童話',
  '氣球', '冰淇淋', '木馬', '風箏', '鞦韆', '捉迷藏', '紙船', '玻璃珠', '麥田', '風鈴', '熱氣球', '銀河', '極光', '流星', '日出', '彩虹色'];

const TIMES = ['19:00', '19:30', '20:00', '14:00', '18:30'];

// ---------- 建库 + 建表 · Create DB + tables ----------
const db = createClient(connection());
const schema = readFileSync(resolve(process.cwd(), 'schema.sql'), 'utf8');
await db.executeMultiple(schema);
console.log('✓ schema.sql 执行完成');

// ---------- 幂等迁移：旧域名 site_url 升级为新域名（仅精确匹配旧值，不覆盖运营已改的其他域名） ----------
// schema.sql 里的 INSERT OR IGNORE 对新装库有效，但不会更新已存在的行，故此处单独处理。
// ---------- Idempotent migration: upgrade the old site_url domain to the new one (matches the old value exactly; won't overwrite other operator-edited domains) ----------
// The INSERT OR IGNORE in schema.sql works for fresh DBs but never updates existing rows, hence this separate handling.
const OLD_SITE_URL = 'https://ilive.lyc.la';
const NEW_SITE_URL = 'https://iliveworld.lyc.la';
const siteUrlRow = await db.execute('SELECT site_url FROM site_settings WHERE id = 1');
if (String(siteUrlRow.rows[0]?.site_url || '') === OLD_SITE_URL) {
  await db.execute({ sql: 'UPDATE site_settings SET site_url = ? WHERE id = 1', args: [NEW_SITE_URL] });
  console.log('✓ site_settings.site_url 已从旧域名迁移到新域名');
}

// ---------- 幂等迁移：清除旧版明文 IP 的点赞残留行 ----------
// ip 列已改为存 HMAC-SHA256 哈希（见 server/utils/concertLikes.resolveClientIp），
// 旧明文行永不再被匹配，留着只会泄露个人数据，直接删除；
// 冗余列 concerts.likes 的基线热度值不受影响（不随行的删除而减）。
// ---------- Idempotent migration: purge legacy plaintext-IP like rows ----------
// The ip column now stores HMAC-SHA256 hashes (see server/utils/concertLikes.resolveClientIp);
// old plaintext rows will never match again and only leak PII, so delete them outright;
// the redundant concerts.likes baseline heat value is unaffected (it does not decrement with row deletion).
const legacyLikes = await db.execute('SELECT id, ip FROM concert_likes');
const legacyIds = legacyLikes.rows
  .filter((r) => !/^[0-9a-f]{64}$/.test(String(r.ip)))
  .map((r) => Number(r.id));
if (legacyIds.length) {
  await withTx(async (ex) => {
    for (const id of legacyIds) await ex.execute({ sql: 'DELETE FROM concert_likes WHERE id = ?', args: [id] });
  });
  console.log(`✓ 清理旧明文 IP 点赞残留行 ${legacyIds.length} 条`);
}

// ---------- 幂等写入 60 场演唱会 + 歌单（单事务内执行） · Idempotently insert 60 concerts + setlists (in one transaction) ----------
let inserted = 0, skipped = 0;
await withTx(async (ex) => {
for (let i = 0; i < 60; i++) {
  const seq = i + 1;
  const exists = await ex.execute({ sql: 'SELECT id FROM concerts WHERE seq = ?', args: [seq] });
  if (exists.rows.length) { skipped++; continue; }

  const city = CITIES[i % CITIES.length];
  const venue = VENUES[i % VENUES.length];
  const seat = SEATS[i % SEATS.length];
  const price = 180 + (i % 10) * 40;
  const month = String((i % 12) + 1).padStart(2, '0');
  const day = String(((i * 3) % 27) + 1).padStart(2, '0');
  const date = `2025-${month}-${day}`;
  const time = TIMES[i % TIMES.length];
  const likes = 40 + ((i * 37) % 180);

  const res = await ex.execute({
    sql: `INSERT INTO concerts
      (artist_i18n, concert_name_i18n, theme_i18n, country_i18n, province_i18n, city_i18n, venue_i18n,
       seat_i18n, price_i18n, date, time, poster, description_i18n, video_i18n, video_url_i18n, seq, likes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      I(ARTISTS_ZH[i], ARTISTS_EN[i], ARTISTS_HANT[i]),
      I(NAMES_ZH[i], NAMES_EN[i], NAMES_HANT[i]),
      I(GENRES_ZH[i % GENRES_ZH.length], GENRES_EN[i % GENRES_EN.length], GENRES_HANT[i % GENRES_HANT.length]),
      I('中国', 'China', '中國'),
      I('—', '—', '—'),
      I(city[0], city[1], city[2]),
      I(venue[0], venue[1], venue[2]),
      I(seat[0], seat[1], seat[2]),
      I(`¥ ${price}`, `¥ ${price}`, `¥ ${price}`),
      date, time, '',
      I(`${ARTISTS_ZH[i]} 领衔的「${NAMES_ZH[i]}」，落地${city[0]}${venue[0]}。`,
        `${NAMES_EN[i]} led by ${ARTISTS_EN[i]}, live at ${venue[1]} in ${city[1]}.`,
        `${ARTISTS_HANT[i]} 領銜的「${NAMES_HANT[i]}」，落地${city[2]}${venue[2]}。`),
      I('', '', ''), I('', '', ''),
      seq, likes
    ]
  });

  const concertId = Number(res.lastInsertRowid);
  const n = 3 + (i % 4);   // 每场 3~6 首 · 3~6 songs per concert
  const start = (i * 2) % SONGS_ZH.length;
  for (let s = 0; s < n; s++) {
    const k = (start + s) % SONGS_ZH.length;
    // 演示链接：指向音乐平台按歌名的搜索页，信息卡歌单弹窗据此显示“播放”按钮
    // Demo link: points to the music platform's search page by song title; the card setlist modal shows a "play" button based on it
    const link = 'https://music.163.com/#/search/m/?s=' + encodeURIComponent(SONGS_ZH[k]);
    await ex.execute({
      sql: 'INSERT INTO concert_songlist (concert_id, i18n, link, seq) VALUES (?, ?, ?, ?)',
      args: [concertId, I(SONGS_ZH[k], SONGS_EN[k], SONGS_HANT[k]), link, s + 1]
    });
  }
  inserted++;
}
});

console.log(`✓ 演唱会写入完成：新增 ${inserted}，跳过（已存在） ${skipped}`);

// ---------- 幂等写入标签（concert_tags）：每场若无标签则补 2~3 个（可重复执行，单事务） · Idempotent tags (concert_tags): top up 2~3 per concert if none (re-runnable, single transaction) ----------
let tagInserted = 0;
const allConcerts = await db.execute('SELECT id, seq FROM concerts ORDER BY seq, id');
await withTx(async (ex) => {
for (const c of allConcerts.rows) {
  const cid = Number(c.id);
  const has = await ex.execute({ sql: 'SELECT COUNT(*) n FROM concert_tags WHERE concert_id = ?', args: [cid] });
  if (Number(has.rows[0].n) > 0) continue;   // 已有标签则跳过，不覆盖运营已改的内容 · skip if tags exist; don't overwrite operator edits
  const i = Number(c.seq) - 1;
  const cnt = 2 + (i % 2);   // 每场 2~3 个标签 · 2~3 tags per concert
  for (let s = 0; s < cnt; s++) {
    const k = (i * 3 + s) % TAGS_ZH.length;
    await ex.execute({
      sql: 'INSERT INTO concert_tags (concert_id, i18n, seq) VALUES (?, ?, ?)',
      args: [cid, I(TAGS_ZH[k], TAGS_EN[k], TAGS_HANT[k]), s + 1]
    });
    tagInserted++;
  }
}
});
console.log(`✓ 标签写入完成：新增 ${tagInserted} 条`);

// ---------- 幂等扩充大歌单：指定 seq 的演唱会补足到 25 / 40 首（测试超过 20 首时的弹窗滚动与展示）
// ---------- Idempotent big-setlist expansion: pad targeted seq concerts up to 25 / 40 songs (tests modal scrolling/display beyond 20) ----------
const BIG_SETLIST_RULES = [
  { match: (seq) => seq % 10 === 3, target: 25 },   // 部分场次25 首（略超 20） · some shows 25 (slightly over 20)
  { match: (seq) => seq % 10 === 7, target: 40 },   // 部分场次40 首（明显超过 20，接近歌单名池上限） · some shows 40 (well over 20, near the song-name pool cap)
];
let bigExpanded = 0;
await withTx(async (ex) => {
for (const c of allConcerts.rows) {
  const cid = Number(c.id), seq = Number(c.seq);
  const rule = BIG_SETLIST_RULES.find(r => r.match(seq));
  if (!rule) continue;
  const cur = await ex.execute({ sql: 'SELECT COUNT(*) n, MAX(seq) mx FROM concert_songlist WHERE concert_id = ?', args: [cid] });
  const n = Number(cur.rows[0].n), mx = Number(cur.rows[0].mx) || 0;
  if (n >= rule.target) continue;   // 已达目标数量则跳过，不覆盖运营已增删的内容 · skip once target reached; don't overwrite operator add/removals
  for (let s = 0; s < rule.target - n; s++) {
    const k = (mx + s) % SONGS_ZH.length;
    await ex.execute({
      sql: 'INSERT INTO concert_songlist (concert_id, i18n, link, seq) VALUES (?, ?, ?, ?)',
      args: [cid, I(SONGS_ZH[k], SONGS_EN[k], SONGS_HANT[k]), '', mx + s + 1]
    });
    bigExpanded++;
  }
}
});
console.log(`✓ 大歌单扩充完成：新增 ${bigExpanded} 首歌（指定场次补足到 25 / 40 首）`);

// ---------- 幂等回填歌单链接：仅补空 link（演示：指向音乐平台搜索页），不覆盖运营已填链接
// ---------- Idempotent setlist-link backfill: fill only empty links (demo: music-platform search page); won't overwrite operator-filled links ----------
let linkUpdated = 0;
const emptyLinks = await db.execute("SELECT id, i18n FROM concert_songlist WHERE link IS NULL OR link = ''");
await withTx(async (ex) => {
for (const r of emptyLinks.rows) {
  let nm = '';
  try { const o = JSON.parse(String(r.i18n)); nm = o['zh-CN'] || o['en'] || Object.values(o)[0] || ''; } catch { nm = String(r.i18n); }
  const url = 'https://music.163.com/#/search/m/?s=' + encodeURIComponent(String(nm));
  await ex.execute({ sql: 'UPDATE concert_songlist SET link = ? WHERE id = ?', args: [url, Number(r.id)] });
  linkUpdated++;
}
});
console.log(`✓ 歌单链接回填完成：更新 ${linkUpdated} 条（仅空链接）`);

// ---------- 幂等回填视频：仅补空 video_url（演示 BV 号，运营可替换为真实可播放视频） ----------
// 信息卡「观看视频」弹窗会把 BV 号拼成 https://player.bilibili.com/player.html?bvid=<BV>&autoplay=1
// ---------- Idempotent video backfill: fill only empty video_url (demo BV ids; operators may replace with real playable videos) ----------
// The card's "watch video" modal builds the player URL https://player.bilibili.com/player.html?bvid=<BV>&autoplay=1 from the BV id
const VIDEO_POOL = ['BV1GJ411x7h7'];   // 演示用 Bilibili BV 号池（占位，请替换为真实视频） · demo Bilibili BV id pool (placeholder; replace with real videos)
let videoUpdated = 0;
const allForVideo = await db.execute('SELECT id, seq, video_url_i18n FROM concerts ORDER BY seq, id');
await withTx(async (ex) => {
for (const r of allForVideo.rows) {
  let isEmpty = true;
  try { const o = JSON.parse(String(r.video_url_i18n || '{}')); isEmpty = !Object.values(o).some(v => String(v).trim()); }
  catch { isEmpty = !String(r.video_url_i18n || '').trim(); }
  if (!isEmpty) continue;   // 已有视频则跳过，不覆盖运营已填内容 · skip if a video exists; don't overwrite operator-filled content
  const bv = VIDEO_POOL[(Number(r.seq) - 1) % VIDEO_POOL.length];
  await ex.execute({
    sql: 'UPDATE concerts SET video_url_i18n = ?, video_i18n = ? WHERE id = ?',
    args: [I(bv, bv, bv), I('官方现场视频', 'Official live video', '官方現場視頻'), Number(r.id)]
  });
  videoUpdated++;
}
});
console.log(`✓ 视频链接回填完成：更新 ${videoUpdated} 条（仅空视频）`);

// 校验 · Verify
const c1 = await db.execute('SELECT COUNT(*) c FROM concerts');
const c2 = await db.execute('SELECT COUNT(*) c FROM concert_songlist');
const c3 = await db.execute('SELECT COUNT(*) c FROM concert_tags');
console.log(`  concerts=${c1.rows[0].c} songlist=${c2.rows[0].c} tags=${c3.rows[0].c}`);
db.close();
