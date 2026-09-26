// @ts-nocheck
/* =====================================================================
 * card.ts —— 信息卡：样式注入、卡片 DOM、点赞（乐观更新）、歌单/视频弹窗入口
 * 由拆分前的单文件 concert 逐段搬移而来，逻辑未变。持有 UI 态：
 *   shownStageIdx（当前点击打开的舞台）/ activeInfo（当前卡片数据）/
 *   likingBusy / likeAbort（在途点赞请求）。
 * card.ts — info card: stylesheet injection, card DOM, likes (optimistic update), setlist/video modal entries.
 * Moved verbatim from the pre-split single concert file; logic unchanged. Owns UI state:
 *   shownStageIdx (stage whose card is open) / activeInfo (current card data) /
 *   likingBusy / likeAbort (in-flight like request).
 * ===================================================================== */
import { cardCss } from './cardCss';
import { esc, safeUrl, videoEmbedUrl, videoPageUrl } from './safeLink';

export function createCard({ C, L, THREE, camera, dom, stages, modal }) {
  /* ---------- 卡片样式（注入 <head>，颜色读 CONFIG.card）· Card CSS (injected into head, colors from CONFIG.card) ---------- */
  const style = document.createElement('style');
  style.id = 'concert-card-style';
  style.textContent = cardCss(C);
  document.head.appendChild(style);

  /* ---------- 信息卡 DOM · Info-card DOM ---------- */
  const card = document.createElement('div');
  card.className = 'concert-card';
  card.innerHTML = '<div class="cc-head"><span class="cc-title"></span><span class="cc-close">×</span></div>' +
    '<div class="cc-star"></div>' +
    '<div class="cc-rows"></div>' +
    '<div class="cc-actions">' +
    '<button class="cc-like" type="button"></button>' +
    '<button class="cc-btn cc-setlist" type="button"></button>' +
    '<button class="cc-btn cc-watch" type="button"></button>' +
    '<button class="cc-btn cc-open" type="button"></button>' +
    '</div>' +
    '<div class="cc-arrow"></div>';
  document.body.appendChild(card);
  const titleEl = card.querySelector('.cc-title');
  const starEl = card.querySelector('.cc-star');
  const rowsEl = card.querySelector('.cc-rows');
  const likeEl = card.querySelector('.cc-like');
  const setlistEl = card.querySelector('.cc-setlist');
  const watchEl = card.querySelector('.cc-watch');
  const openEl = card.querySelector('.cc-open');
  let shownStageIdx = -1;   // 当前已用「点击」打开卡片的舞台索引 · stage index whose card was opened by click
  const closeModal = modal.closeModal;
  card.querySelector('.cc-close').addEventListener('click', e => { e.stopPropagation(); hideCard(); closeModal(); });
  card.addEventListener('pointerdown', e => e.stopPropagation());
  card.addEventListener('pointerup', e => e.stopPropagation());

  let activeInfo = null;
  function renderLike() {
    const inf = activeInfo;
    if (!inf || inf.source !== 'db' || inf.id == null) { likeEl.classList.remove('on'); return; }
    likeEl.classList.add('on');
    likeEl.textContent = (inf.liked ? L.liked : L.like) + '  ' + inf.likes;
  }
  function buildRows(inf) {
    const rows = [];
    if (inf.source === 'db') {
      if (inf.artist) rows.push([L.artist, inf.artist]);
      if (inf.place) rows.push([L.place, inf.place]);
      if (inf.time) rows.push([L.time, inf.time]);
      if (inf.seat) rows.push([L.seat, inf.seat]);
      if (inf.price) rows.push([L.price, inf.price]);
      if (inf.tags && inf.tags.length) rows.push([L.tags, inf.tags, 'tags']);
      // 歌单不再内联展示（已由「查看歌单」按钮在弹窗中呈现完整列表），但 inf.songs 仍保留供该按钮使用
      // Setlist is no longer inlined (shown fully in a modal via the "view setlist" button); inf.songs is kept for that button
    } else {
      rows.push([L.genre, inf.genre]);
      rows.push([L.heat, '★'.repeat(inf.heat) + '☆'.repeat(5 - inf.heat)]);
      rows.push([L.fans, fmtFans(L, inf.fanCount || 4)]);
      rows.push([L.session, inf.time]);
    }
    return rows.map(([k, v, kind]) => {
      if (kind === 'tags') {
        const chips = (v as string[]).map(t => '<span class="cc-tag">' + esc(String(t)) + '</span>').join('');
        return '<div class="cc-row"><span>' + esc(k) + '</span><b class="cc-tags">' + chips + '</b></div>';
      }
      return '<div class="cc-row"><span>' + esc(k) + '</span><b>' + esc(String(v)) + '</b></div>';
    }).join('');
  }
  function fmtFans(l, n) {
    return String(n);
  }

  function placeCard(x, y) {
    const w = C.card.width, h = card.offsetHeight || 210;
    let cx = Math.max(10, Math.min(window.innerWidth - w - 10, x - w / 2));
    const below = y < window.innerHeight / 2;
    let cy = below ? y + 18 : y - h - 18;
    cy = Math.max(10, Math.min(window.innerHeight - h - 10, cy));
    card.style.left = cx + 'px';
    card.style.top = cy + 'px';
    const arrow = card.querySelector('.cc-arrow');
    const ax = Math.max(20, Math.min(w - 30, x - cx - 7));
    if (below) { arrow.style.left = ax + 'px'; arrow.style.bottom = '-9px'; arrow.style.top = 'auto'; arrow.style.transform = 'rotate(45deg)'; }
    else { arrow.style.left = ax + 'px'; arrow.style.top = '-9px'; arrow.style.bottom = 'auto'; arrow.style.transform = 'rotate(-135deg)'; }
  }
  // 填充卡片内容（标题/主演/各行/点赞/操作按钮），供 showCard 首次展示与 setLang 语言切换复渲染共用。
  // 只负责写 DOM，不动位置、不碰弹窗、不改 .show 态——位置与显隐分别由 showCard / refresh 处理。
  // Fill card content (title/star/rows/like/actions), shared by showCard (first open) and refresh
  // (language switch). It only writes DOM; positioning and visibility stay with showCard / refresh.
  function renderContent(inf) {
    titleEl.textContent = inf.name;
    if (inf.source === 'db') {
      starEl.textContent = inf.theme || '';
    } else {
      starEl.textContent = L.starring + '：' + inf.star + '（' + inf.ear + L.earSuffix + '）';
    }
    rowsEl.innerHTML = buildRows(inf);
    renderLike();
    renderActions();
  }
  function showCard(st, x, y) {
    const inf = st.info;
    activeInfo = inf;
    // 统一在此记录当前展示的舞台（点击与搜索聚焦两条开卡路径都会经过 showCard），
    // 使 isShownFor（再点同一舞台收起）与语言切换 refresh 都能正确定位。
    // Record the shown stage centrally here (both the click and search-focus paths flow through
    // showCard) so isShownFor (re-click to collapse) and the language-switch refresh can locate it.
    shownStageIdx = st.g.userData.stageIdx;
    renderContent(inf);
    closeModal();   // 切换/重开卡片时收起可能残留的弹窗 · dismiss any leftover modal when switching/reopening the card
    card.classList.add('show');
    placeCard(x, y);
  }

  // 供搜索框按演唱会 id 直接弹出信息卡：把舞台世界坐标投影为屏幕像素后 showCard
  // （镜头朝向由 planetTown.focusConcert 负责，这里只负责投影 + 展示）
  // Lets the search box pop a card directly by concert id: project the stage's world position to screen pixels, then showCard
  // (camera facing is handled by planetTown.focusConcert; here we only project + display)
  function showCardById(id) {
    const st = stages.find(s => s.info && s.info.id === id);
    if (!st) return false;
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const v = st.g.getWorldPosition(new THREE.Vector3()).project(camera);
    const rect = dom.getBoundingClientRect();
    const x = rect.left + (v.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-v.y * 0.5 + 0.5) * rect.height;
    showCard(st, x, y);   // shownStageIdx 统一在 showCard 内维护 · shownStageIdx is maintained inside showCard
    return true;
  }

  // 点赞（乐观更新）· Like (optimistic update)
  let likingBusy = false;
  let likeAbort = null;   // 在途点赞请求的取消器：dispose 时 abort，避免回调操作已摘除的 DOM · in-flight like abort; cancelled on dispose
  likeEl.addEventListener('click', async e => {
    e.stopPropagation();
    const inf = activeInfo;
    if (!inf || inf.source !== 'db' || inf.id == null || likingBusy) return;
    likingBusy = true;
    const prevLiked = inf.liked, prevLikes = inf.likes;
    inf.liked = !inf.liked; inf.likes += inf.liked ? 1 : -1; renderLike();
    try {
      const ac = new AbortController();
      likeAbort = ac;
      const res = await fetch('/api/concerts/' + inf.id + '/like', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ liked: inf.liked }),
        signal: ac.signal
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.likes === 'number') inf.likes = data.likes;
        if (typeof data.liked === 'boolean') inf.liked = data.liked;
        renderLike();
      } else { throw new Error('bad status'); }
    } catch (err) {
      // dispose() 调 abort 引发的 AbortError 无需回滚/重绘，避免触碰已摘除的 DOM
      // An AbortError raised by dispose() needs no rollback/repaint (avoids touching removed DOM)
      const e = err as { name?: string };
      if (e && e.name === 'AbortError') return;
      inf.liked = prevLiked; inf.likes = prevLikes; renderLike();
    } finally { likingBusy = false; }
  });

  // 操作按钮渲染：查看歌单 / 观看视频 / 打开视频（无对应数据则隐藏）
  // Action-button rendering: view setlist / watch video / open video (hidden when no matching data)
  function renderActions() {
    const inf = activeInfo;
    const isDb = !!(inf && inf.source === 'db');
    setlistEl.classList.toggle('on', !!(isDb && inf.songs && inf.songs.length));
    setlistEl.textContent = L.viewSetlist;
    const hasVideo = !!(isDb && inf.videoUrl);
    watchEl.classList.toggle('on', hasVideo);
    watchEl.textContent = L.watchVideo;
    openEl.classList.toggle('on', hasVideo);
    openEl.textContent = L.openVideo;
  }

  setlistEl.addEventListener('click', e => {
    e.stopPropagation();
    const inf = activeInfo;
    if (!inf || !Array.isArray(inf.songs) || !inf.songs.length) return;
    openSetlistModal(inf);
  });

  // 完整歌单弹窗：顶部搜索框实时过滤，带 link 的行显示播放按钮
  // Full setlist modal: a top search box filters live; rows with a link show a play button
  function openSetlistModal(inf) {
    const songs = inf.songs;
    modal.openModal((inf.name || '') + ' · ' + L.songs,
      '<input class="cc-sl-search" type="text" placeholder="' + esc(L.searchSong) + '" autocomplete="off">' +
      '<ul class="cc-sl-list"></ul>');
    const input = modal.modalBody.querySelector('.cc-sl-search');
    const list = modal.modalBody.querySelector('.cc-sl-list');
    function render(q) {
      const kw = String(q || '').trim().toLowerCase();
      const rows = songs.map((s, i) => ({ s: s, n: i + 1 })).filter(o => !kw || String(o.s.name).toLowerCase().indexOf(kw) >= 0);
      if (!rows.length) { list.innerHTML = '<li class="cc-sl-empty">' + esc(L.noMatch) + '</li>'; return; }
      list.innerHTML = rows.map(o => {
        const play = (o.s.link && safeUrl(o.s.link)) ? '<button class="cc-sl-play" type="button" data-link="' + esc(o.s.link) + '">▶ ' + esc(L.play) + '</button>' : '';
        return '<li class="cc-sl-item"><span class="cc-sl-idx">' + o.n + '</span><span class="cc-sl-name">' + esc(o.s.name) + '</span>' + play + '</li>';
      }).join('');
    }
    render('');
    input.addEventListener('input', () => render(input.value));
    list.addEventListener('click', e => {
      const btn = e.target.closest ? e.target.closest('.cc-sl-play') : null;
      if (!btn) return;
      e.stopPropagation();
      const link = btn.getAttribute('data-link');
      const safe = safeUrl(link);
      if (safe) window.open(safe, '_blank', 'noopener');
    });
    setTimeout(() => { try { input.focus(); } catch (err) {} }, 30);
  }
  watchEl.addEventListener('click', e => {
    e.stopPropagation();
    const inf = activeInfo;
    if (!inf || !inf.videoUrl) return;
    // 弹窗标题统一用“艺人名 - 演唱会名称”（缺艺人名时退回演唱会名称）；非白名单嵌入地址不渲染 iframe
    // Modal title standardizes on "artist - concert name" (falls back to concert name without an artist); non-allowlisted embed URLs do not render an iframe
    const mt = inf.artist ? inf.artist + ' - ' + inf.name : (inf.name || '');
    const embed = safeUrl(videoEmbedUrl(inf.videoUrl, inf.video));
    modal.openModal(mt, embed
      // sandbox 去掉 allow-same-origin：allow-scripts + allow-same-origin 是已知危险组合，
      // 白名单内包含本站域名 iliveworld.lyc.la，同源嵌入可借机脱离沙箱、访问顶层页 Cookie/存储；
      // 跨站 Bilibili 播放器以不透明源运行仍可正常嵌入播放，故仅保留 allow-scripts / allow-presentation。
      // Drop allow-same-origin: allow-scripts + allow-same-origin is a known dangerous pair; the allowlist
      // includes this site's own domain (iliveworld.lyc.la), so a same-origin embed could escape the sandbox
      // and reach the top frame's cookies/storage. Cross-origin players still embed/play under an opaque origin.
      ? '<div class="cc-video-frame"><iframe src="' + esc(embed) + '" sandbox="allow-scripts allow-presentation" allow="autoplay; encrypted-media; fullscreen" allowfullscreen referrerpolicy="no-referrer"></iframe></div>'
      : '<div style="padding:14px 4px;color:#7a6440;line-height:1.6;">' + esc(L.noMatch) + '</div>');
  });
  openEl.addEventListener('click', e => {
    e.stopPropagation();
    const inf = activeInfo;
    if (!inf || !inf.videoUrl) return;
    // 直接跳转 video_url_i18n 存储的原始链接（须通过白名单校验）；若存的是裸 BV 号（非 URL）则退回拼接观看页
    // Navigate straight to the raw link stored in video_url_i18n (must pass the allowlist); if a bare BV id (not a URL) is stored, fall back to the built watch page
    const raw = String(inf.videoUrl).trim();
    const target = safeUrl(/^(https?:\/\/|\/\/)/i.test(raw) ? raw : videoPageUrl(inf.videoUrl, inf.video));
    if (target) window.open(target, '_blank', 'noopener');
  });

  /** 收起卡片（不触碰弹窗）· Collapse the card (leaves the modal alone) */
  function hideCard() { card.classList.remove('show'); shownStageIdx = -1; }
  /** 卡片当前是否正展示指定舞台 · Is the card currently shown for this stage index? */
  function isShownFor(idx) { return idx === shownStageIdx && card.classList.contains('show'); }
  /**
   * 语言切换后就地重绘已打开的卡片：不重定位、不改变显隐，仅用最新文案 L 与该舞台
   * 最新的 st.info 重新填充 DOM。注意 activeInfo 需重新绑定——applyDbInfo 会把 st.info
   * 换成全新对象，旧 activeInfo 仍指向切换前的数据，不重绑就会渲染出旧语言内容。
   * Repaint an already-open card in place after a language switch: no reposition / visibility
   * change, just refill the DOM from the updated copy L and the stage's latest st.info. activeInfo
   * must be rebound — applyDbInfo replaces st.info with a brand-new object, so a stale activeInfo
   * would keep rendering the pre-switch (old-language) content.
   */
  function refresh() {
    if (shownStageIdx < 0 || !card.classList.contains('show')) return;
    const st = stages[shownStageIdx];
    if (!st || !st.info) return;
    activeInfo = st.info;   // 重绑到 applyDbInfo 生成的新对象 · rebind to the object applyDbInfo just produced
    renderContent(activeInfo);
  }

  function dispose() {
    likeAbort?.abort();   // 取消在途点赞请求，避免其后回调操作已摘除的 DOM · cancel in-flight like to avoid touching removed DOM
    if (card.parentNode) card.parentNode.removeChild(card);
    if (style.parentNode) style.parentNode.removeChild(style);
  }

  return { showFor: showCard, hide: hideCard, isShownFor, showCardById, refresh, dispose };
}
