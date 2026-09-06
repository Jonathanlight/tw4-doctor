<template>
  <main class="p-8">
    <button class="ring rounded-sm">Click</button>
    <div :class="{ 'text-red-500': hasError, 'border': true }">Status</div>
  </main>
</template>

<style>
.page-title {
  @apply text-2xl font-bold;
}
</style>
