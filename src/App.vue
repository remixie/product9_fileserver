<script setup lang="ts">
import { reactive } from "vue";
import axios from "redaxios";
import { ref } from "vue";

let fileForm = ref();
let server_response = reactive({ data: [] });
let found_fields = reactive({ data: [], filename: "" });

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
  
  let temp = Object.values(list.data).filter((obj:string) => {
    return obj.includes('.json')
  })

  for (let l in temp) {
    linked_fields.data = new Array()
    getLinkedFields(temp[l]) 
  }
};
fetchData();

//get x,y,z etc etc
let dimensions = reactive({ data: [] });
let getDimensions = async () => {
  const dimensions_response = await axios.get("/get-dimensions")
  dimensions.data = dimensions_response.data
  resetFields()
}

let resetFields = () => {
  selected_fields.value = new Array(dimensions.data.length).fill(null)
}

getDimensions();

//get fields from file
let detectFields = async (filename: string) => {
  const response = await axios.get("/detect-fields/" + filename);
  found_fields.data = response.data;
  found_fields.filename = filename;
  resetFields()
};

let setFields = async (filename: string,) => {

  const resp = await axios({
    method: "post",
    url: "/set-fields/" + filename,
    headers: { 'Content-Type': 'application/json' },
    data: selected_fields.value,
  }) as { data: [] };

  server_response.data = resp.data
  fetchData();
};
const selected_fields = ref(Array())

let view = (filename: string) => {
  window.location.href = "/file/" + filename;
};
let del = async (filename: string) => {
  server_response = await axios.delete("/file/" + filename);
  fetchData();
};

let convert = async (filename: string) => {
  server_response = await axios.post("/convert/" + filename);
  fetchData();
};

let linked_fields = reactive({data:[] as object[]});
let getLinkedFields = async (filename: string) => {
  const response = await axios.get("/get-fields/" + filename);
  linked_fields.data.push(response.data);
}
</script>

<template>
  <h2>Product9 File Server</h2>
  <div>
    <b>API Calls:</b>
    <br>POST /fileupload
    <br>GET /filelist
    <br>GET /assets/:filename
    <br>GET /file/:filename
    <br>DELETE /file/:filename
    <br>POST /convert/:filename
    <br>GET /get-fields/:filename
    <br>POST /set-fields/:filename
    <br>GET /get-dimensions
    <br>GET /detect-fields/:filename
  </div>
  <br>
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
    value="Upload JSON/CSV dataset"
    @click="submitFile()"
  >
  <br>
  <div>{{ server_response.data.length ? server_response.data : "" }}</div>
  <div v-if="found_fields.data.length">
    <div
      v-for="(d, i) in dimensions.data"
      :key="i"
    >
      {{ d }}:
      <select v-model="selected_fields[i]">
        <option
          v-for="f in found_fields.data"
          :key="f"
        >
          {{ f }}
        </option>
      </select>
    </div>
    <button @click="setFields(found_fields.filename)">
      Save Fields as Dimensions
    </button>
  </div>
  <div>
    <h2>Uploaded Dataset(s)</h2>
  </div>
  <div
    v-for="(l, i) in list.data"
    :key="i"
  >
    {{ l }}
    <div>
      {{ linked_fields.data[i] }}
    </div>
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
      @click="detectFields(l)"
    >
      Edit Dimensions
    </button>
    <button @click="del(l)">
      Delete
    </button>
    <br><br>
  </div>
</template>
