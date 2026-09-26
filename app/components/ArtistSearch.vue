<script setup lang="ts">
// 头部搜索框：对「艺人名称」、「演唱会主题」、「城市」与「演唱会名称」做模糊匹配（子串优先，退化为连续子序列），
// 输入时在下方浮层实时展示匹配结果，点击直接把镜头转到对应演唱会并弹出信息卡。放在导航「ilive」之前。
// Header search box: fuzzy-matches artist / theme / city / concert name (substring first,
// falling back to an in-order subsequence). Results render live in a dropdown; picking one
// flies the camera to that concert and pops its info card. Sits before the "ilive" nav link.
const { t } = useI18n();
const localePath = useLocalePath();
const router = useRouter();
const { data: concerts } = useConcerts();

// 搜索用的最小数据切片 / 按艺人聚合组 / 单条命中结果 · minimal slices used by the search
interface ArtistConcert { id: number; name: string; city: string; date: string; theme: string }
interface ArtistGroup { name: string; concerts: ArtistConcert[] }
interface SearchResult { artist: ArtistGroup; target: ArtistConcert | undefined; score: number; byField: boolean }

// 按艺人聚合（同名艺人合并其多场演唱会）
// Group by artist (same name merges all of that artist's concerts)
const artists = computed<ArtistGroup[]>(() => {
  const map = new Map<string, ArtistGroup>();
  for (const c of (concerts.value || [])) {
    const key = (c.artist || '').trim();
    if (!key) continue;
    if (!map.has(key)) map.set(key, { name: key, concerts: [] });
    map.get(key)!.concerts.push({ id: c.id, name: c.name, city: c.city, date: c.date, theme: c.theme || '' });
  }
  return [...map.values()];
});

// 模糊打分：命中子串优先（靠前加分），否则退化为连续子序列匹配；不匹配返回 -1
// Fuzzy score: substring hits win (earlier = higher), else an in-order subsequence with gap penalty;
// -1 means no match.
function fuzzyScore(text: string, q: string): number {
  if (!q) return 0;
  const T = text.toLowerCase();
  const Q = q.toLowerCase();
  const idx = T.indexOf(Q);
  if (idx >= 0) return 1000 - idx;
  let ti = 0, gaps = 0, last = -1;
  for (const ch of Q) {
    const found = T.indexOf(ch, ti);
    if (found < 0) return -1;
    if (last >= 0) gaps += found - last - 1;
    last = found;
    ti = found + 1;
  }
  return 500 - gaps;
}

const query = ref('');
const open = ref(false);
// 结果：艺人名称与旗下各场的「主题 / 城市 / 演唱会名称」分别打分取最高；靠字段命中时，聚焦命中的那场，否则聚焦首场
// Ranking: max(artist-name score, best per-concert field score); when a field wins, focus that concert,
// otherwise focus the artist's first one.
const results = computed<SearchResult[]>(() => {
  const q = query.value.trim();
  if (!q) return [];
  const out: SearchResult[] = [];
  for (const a of artists.value) {
    const nameScore = fuzzyScore(a.name, q);
    let fieldScore = -1;
    let fieldHit: ArtistConcert | undefined;
    for (const c of a.concerts) {
      const s = Math.max(fuzzyScore(c.theme, q), fuzzyScore(c.city, q), fuzzyScore(c.name, q));
      if (s > fieldScore) { fieldScore = s; fieldHit = c; }
    }
    const score = Math.max(nameScore, fieldScore);
    if (score < 0) continue;
    const byField = fieldScore >= nameScore && !!fieldHit;
    out.push({ artist: a, target: byField ? fieldHit : a.concerts[0], score, byField });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 8);
});

const root = ref<HTMLElement | null>(null);
// 键盘导航：↑/↓ 移动高亮、Enter 打开高亮项、Esc 关闭面板（高亮索引随结果/query 变化重置）
// Keyboard nav: ↑/↓ move the highlight, Enter opens it, Esc closes the panel;
// the highlight resets whenever results or the query change.
const active = ref(-1);
watch([query, results], () => { active.value = -1; });
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { open.value = false; return; }
  if (!open.value || !query.value.trim()) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); active.value = Math.min(active.value + 1, results.value.length - 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = Math.max(active.value - 1, 0); }
  else if (e.key === 'Enter' && active.value >= 0) {
    const r = results.value[active.value];
    if (r) { e.preventDefault(); pick(r.target?.id); }
  }
}
// 点组件外关闭浮层 · dismiss the dropdown when clicking outside
function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
function pick(id?: number) {
  open.value = false;
  query.value = '';
  // 回到首页 / 并用 ?concert=<id> 标记要直接弹出信息卡的演唱会
  // Go home, carrying ?concert=<id> so the canvas focuses that concert and pops its card
  router.push(localePath({ path: '/', query: id ? { concert: String(id) } : {} }));
}
onMounted(() => document.addEventListener('click', onDocClick, true));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick, true));   // 卸载时移除监听 · remove listener on unmount
</script>

<template>
  <div ref="root" class="artist-search">
    <div class="as-box" :class="{ focus: open }">
      <span class="as-icon" aria-hidden="true">🔍</span>
      <input
        v-model="query"
        type="text"
        class="as-input"
        :placeholder="t('search.placeholder')"
        :aria-label="t('search.placeholder')"
        autocomplete="off"
        role="combobox"
        :aria-expanded="open && !!query.trim()"
        aria-controls="as-results"
        aria-autocomplete="list"
        @focus="open = true"
        @keydown="onKeydown"
      >
      <button v-if="query" class="as-clear" type="button" :aria-label="t('search.clear')" @click="query = ''">×</button>
    </div>

    <div v-if="open && query.trim()" id="as-results" class="as-panel">
      <p v-if="!results.length" class="as-empty">{{ t('search.empty') }}</p>
      <ul v-else class="as-list" role="listbox">
        <li v-for="(r, i) in results" :key="r.artist.name + '-' + i" role="option" :aria-selected="i === active">
          <button type="button" class="as-item" :class="{ active: i === active }" @click="pick(r.target?.id)" @mouseenter="active = i">
            <span class="as-avatar" aria-hidden="true">🎤</span>
            <span class="as-main">
              <span class="as-name">{{ r.artist.name }}</span>
              <span class="as-meta">
                <template v-if="r.target">{{ r.target.name }}<template v-if="r.target.city"> · {{ r.target.city }}</template><template v-if="r.target.date"> · {{ r.target.date }}</template></template>
                <template v-if="r.artist.concerts.length > 1"> +{{ r.artist.concerts.length - 1 }}</template>
              </span>
              <span v-if="r.target && r.target.theme" class="as-theme">{{ t('card.theme') }}：{{ r.target.theme }}</span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.artist-search { position: relative; }
.as-box {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, .08);
  border: 1px solid rgba(255, 255, 255, .18);
  transition: border-color .18s, background .18s, box-shadow .18s;
}
.as-box.focus {
  border-color: rgba(255, 217, 138, .7);
  background: rgba(255, 255, 255, .14);
  box-shadow: 0 0 0 3px rgba(255, 217, 138, .14);
}
.as-icon { font-size: 13px; opacity: .85; }
.as-input {
  width: 130px;
  border: 0; outline: none; background: transparent;
  color: #fff; font-size: 13px; font-weight: 600; font-family: inherit;
}
.as-input::placeholder { color: #a9b6d6; font-weight: 500; }
.as-clear {
  flex: none; width: 18px; height: 18px;
  border: 0; border-radius: 50%;
  background: rgba(255, 255, 255, .16); color: #fff;
  font-size: 14px; line-height: 1; cursor: pointer;
}
.as-clear:hover { background: rgba(255, 255, 255, .3); }

.as-panel {
  position: absolute; right: 0; top: calc(100% + 8px);
  width: 268px; max-height: 60vh; overflow: auto;
  padding: 6px;
  background: #fff7e8;
  border: 1px solid var(--accent);
  border-radius: 14px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, .34);
}
.as-empty { margin: 0; padding: 14px 10px; text-align: center; color: #8a744d; font-size: 13px; }
.as-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.as-item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 8px 10px; border-radius: 10px; border: 0; background: transparent;
  text-align: left; font: inherit; color: inherit; cursor: pointer;
  transition: background .14s ease;
}
.as-item:hover, .as-item.active { background: #f0e2c4; }
.as-avatar {
  flex: none; width: 30px; height: 30px;
  display: grid; place-items: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffe1a8, #d8b076);
  font-size: 15px;
}
.as-main { display: flex; flex-direction: column; min-width: 0; }
.as-name { font-size: 14px; font-weight: 800; color: #5e4a2e; }
.as-meta {
  font-size: 12px; color: #8a744d; line-height: 1.35;
}
.as-theme {
  margin-top: 2px; font-size: 11px; color: #a9772f; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
</style>
