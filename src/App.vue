<script setup lang="ts">
import Filelist from "./components/Filelist.vue";
</script>

<template>
  <form action="/fileupload" enctype="multipart/form-data" method="POST">
    <input type="file" name="binary" multiple />
    <input type="submit" value="Upload dataset(s)" />
  </form>
  <suspense>
    <filelist />
  </suspense>
</template>
