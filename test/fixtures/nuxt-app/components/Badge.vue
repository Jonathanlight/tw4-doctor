<template>
  <span :class="'inline-flex border px-2 hover:bg-gray-100'">
    <slot />
  </span>
</template>

<style scoped>
.badge {
  @apply rounded border text-sm;
}
</style>
