<script setup lang="ts">
import { reactive } from "vue";
import axios from "redaxios";
import { ref } from "vue";

let fileForm = ref()

let submitFile = async () => {
  let formData = new FormData(fileForm.value);
  await axios({ method: 'post', url: '/fileupload', data: formData,  });
  fetchData();
  fileForm.value.reset()
}

let list = reactive({ data: [] });
let fetchData = async () => {
  const response = await axios.get("/filelist");
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

<template>
  <form
    ref="fileForm"
    style="display: inline-block"
  >
    <input
      type="file"
      name="file"
    >
  </form>
  <input
    type="button"
    style="display: inline-block"
    value="Upload dataset"
    @click="submitFile()"
  >
  <div>
    <h2>Uploaded Dataset(s)</h2>
  </div>
  <div
    v-for="l in list.data"
    :key="l"
  >
    {{ l }}
    <button @click="view(l)">
      View
    </button>
    <button @click="del(l)">
      Delete
    </button>
  </div>
</template>
