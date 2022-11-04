<script setup lang="ts">
import { reactive } from "vue";
import axios from "redaxios";
import { ref } from "vue";

let fileForm = ref();
let server_response = reactive({ data: [] });
let marker_response = reactive({ data: [] });

let submitFile = async () => {
  let formData = new FormData(fileForm.value);
  server_response = await axios({
    method: "post",
    url: "/fileupload",
    data: formData,
  });

  fetchData();
  fileForm.value.reset();
};

let list = reactive({ data: [] });
let fetchData = async () => {
  const response = await axios.get("/filelist");
  list.data = response.data;
};
let view = (filename: string) => {
  window.location.href = "/file/" + filename;
};
let del = async (filename: string) => {
  server_response = await axios.delete("/file/" + filename);
  fetchData();
};

let convert = async (filename: string) =>{
  server_response = await axios.post("/convert/" + filename);
  fetchData();
}

fetchData();

let getMarkers = async (filename: string) => {
  const resp = await axios.get("/detect-markers/" + filename);
  marker_response.data = resp.data;
};

let dimensions = ref(['X','Y','Z','Color','Size'])
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
  <div>{{ server_response.data.length ? server_response.data : "" }}</div>

  <div v-if="marker_response.data.length">
    <div
      v-for="d in dimensions"
      :key="d"
    >
      {{ d }}: <select>
        <option
          v-for="m in marker_response.data"
          :key="m"
        >
          {{ m[0] }}
        </option>
      </select>
    </div>
    <button>Save Dimensions</button>
  </div>
  <div>
    <h2>Uploaded Dataset(s)</h2>
  </div>
  <div
    v-for="l in list.data"
    :key="l"
  >
    {{ l }}  ()
    <button @click="view(l)">
      View
    </button>
    
    <button
      v-if="String(l).includes('.csv')"
      @click="convert(l)"
    >
      Convert To JSON
    </button>
    <button
      v-else
      @click="getMarkers(l)"
    >
      Edit Dimensions
    </button>
    <button @click="del(l)">
      Delete
    </button>
  </div>
</template>
