<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

const statusCode = computed(() => props.error?.statusCode ?? 500);

// 404 / 错误页：不索引 · 404 / error pages: never indexed
useHead({
  title: () => String(statusCode.value),
  meta: [{ name: 'robots', content: 'noindex, nofollow' }]
});

const { t } = useI18n();
const localePath = useLocalePath();
const is404 = computed(() => statusCode.value === 404);
</script>

<template>
  <div class="page" style="text-align: center;">
    <h1 style="font-size: 64px; margin-bottom: 8px;">{{ statusCode }}</h1>
    <p style="color: #c3cee8; font-size: 18px;">
      {{ is404 ? t('error.notFound') : t('error.generic') }}
    </p>
    <p>
      <a :href="localePath('/')" class="btn btn-primary">{{ t('error.backHome') }}</a>
    </p>
  </div>
</template>
