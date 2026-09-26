<script setup lang="ts">
const { t } = useI18n();

// 站点全站 HTTPS：外链/BGM 必须同为 https，否则浏览器按「混合内容」拦截，音频在线上直接不可用
// The site is fully HTTPS: external links / BGM must also be https, or browsers block them as mixed content.
const ILIVE_URL = 'https://ilive.lyc.la';
const FEEDBACK_URL = 'https://github.com/layicr/ilive-world/issues';

// 背景音乐：客户端懒创建 <audio>，循环播放；浏览器禁止带声自动播放，需用户点击触发
// Background music: lazily create an <audio> on the client, looped; browsers block autoplay-with-sound,
// so playback must be triggered by a user click.
const BGM_URL = `${ILIVE_URL}/music/bgm_en.mp3`;
const playing = ref(false);
let audio: HTMLAudioElement | null = null;
// 首次使用时才创建 audio，避免 SSR/首屏多余开销 · create the audio element lazily on first use
function ensureAudio() {
  if (audio) return audio;
  audio = new window.Audio(BGM_URL);
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0.6;
  return audio;
}
async function toggleMusic() {
  const a = ensureAudio();
  if (playing.value) {
    a.pause();
    playing.value = false;
  } else {
    try { await a.play(); playing.value = true; }
    catch { playing.value = false; }   // 自动播放被拦时保持按钮状态一致 · keep button state honest if playback is blocked
  }
}
// 卸载时停止并释放 audio · stop and release the audio on unmount
onBeforeUnmount(() => { if (audio) { audio.pause(); audio = null; } });
</script>

<template>
  <header class="site-header">
    <nav class="nav">
      <ArtistSearch />
      <a :href="ILIVE_URL" target="_blank" rel="noopener">{{ t('nav.ilive') }}</a>
      <button type="button" class="nav-btn" :aria-pressed="playing" @click="toggleMusic">
        <span aria-hidden="true">{{ playing ? '⏸' : '♪' }}</span>
        {{ t('nav.music') }}
      </button>
      <a :href="FEEDBACK_URL" target="_blank" rel="noopener">{{ t('nav.feedback') }}</a>
      <LocaleSwitcher />
    </nav>
  </header>
</template>
