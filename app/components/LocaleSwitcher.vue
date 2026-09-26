<script setup lang="ts">
const { locale, locales } = useI18n();
const switchLocalePath = useSwitchLocalePath();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

const items = computed(() =>
  (locales.value as Array<{ code: string; name?: string }>).map((l) => ({
    code: l.code,
    name: l.name || l.code,
    href: switchLocalePath(l.code as Parameters<typeof switchLocalePath>[0])
  }))
);

// 当前语言名（按钮上显示“简体中文”而非代码“zh-CN”）
// Current language display name (show "简体中文" on the button instead of the "zh-CN" code)
const currentName = computed(
  () => (locales.value as Array<{ code: string; name?: string }>).find(l => l.code === locale.value)?.name || locale.value
);

// 点面板外任意处关闭菜单 · close the menu when clicking outside the component
function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));   // 卸载时移除监听 · remove listener on unmount
</script>

<template>
  <div ref="root" class="locale-switch">
    <button class="locale-btn" type="button" :aria-expanded="open" @click="open = !open">
      🌐 {{ currentName }}
    </button>
    <div v-if="open" class="locale-menu">
      <NuxtLink
        v-for="it in items"
        :key="it.code"
        :to="it.href"
        :class="{ active: it.code === locale }"
        @click="open = false"
      >{{ it.name }}</NuxtLink>
    </div>
  </div>
</template>
