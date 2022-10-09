<script setup lang="ts">
// This starter template is using Vue 3 <script setup> SFCs
// Check out https://vuejs.org/api/sfc-script-setup.html#script-setup
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
    <form action="/fileupload" enctype="multipart/form-data" method="POST">
      <input type="file" name="binary" multiple />
      <input type="submit" value="Upload file(s)" />
    </form>
  <HelloWorld msg="Vite + Vue" />
</template>
