<template>
  <div>
    <h2>Uploaded Dataset(s)</h2>
  </div>
  <div v-for="l in list.data" :key="l">
    {{ l }}
    <button @click="view(l)">View</button>
    <button @click="del(l)">Delete</button>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive } from "vue";
import axios from "redaxios";
const url = ref("/filelist");
let list = reactive({ data: [] });
let fetchData = async () => {
  const response = await axios.get(url.value);
  list.data = response.data;
};
let view = (filename: string) => {
  window.location.href = "/file/" + filename;
};
let del = async (filename: string) => {
  await axios.delete("/file/" + filename);
  fetchData();
};
fetchData();
</script>
