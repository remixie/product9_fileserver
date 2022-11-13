<script setup lang="ts">
import { reactive } from "vue";
import axios from "redaxios";
import { ref } from "vue";

let fileForm = ref();
let server_response = reactive({ data: [] });
let found_fields = reactive({ data: [], filename: "" });
let linked_fields = reactive({ data: [] as object[] });
let list = reactive({ data: [] as string[] });
const is_prod = import.meta.env.PROD;
const selected_fields = ref(Array());
let disabledButton = ref(true);
let resetFields = () => {
  selected_fields.value = new Array(dimensions.data.length).fill(null);
};
//get x,y,z etc etc
let dimensions = reactive({ data: [] });

let submitFile = async () => {
  if (is_prod) {
    let formData = new FormData(fileForm.value);
    server_response = await axios({
      method: "post",
      url: "/fileupload",
      data: formData,
    });

    fetchData();
    fileForm.value.reset();
  }
};

let fetchData = async () => {
  if (is_prod) {
    const response = await axios.get("/filelist");
    list.data = response.data;
    let temp = Object.values(list.data).filter((obj: string) => {
      return obj.includes(".json");
    });
    for (let l in temp) {
      linked_fields.data = new Array();
      getLinkedFields(temp[l]);
    }
  } else {
    list.data = ["example.json"] as string[];
    linked_fields.data = [
      { x: "y", y: "z", z: "z", color: "color", size: "color" },
    ];
  }
};

let getDimensions = async () => {
  const dimensions_response = await axios.get("/get-dimensions");
  dimensions.data = dimensions_response.data;
  resetFields();
};

//get fields from file
let detectFields = async (filename: string) => {
  const response = await axios.get("/detect-fields/" + filename);
  found_fields.data = response.data;
  found_fields.filename = filename;
  resetFields();
};

let setFields = async (filename: string) => {
  const resp = (await axios({
    method: "post",
    url: "/set-fields/" + filename,
    headers: { "Content-Type": "application/json" },
    data: selected_fields.value,
  })) as { data: [] };

  server_response.data = resp.data;
  fetchData();
};

let view = (filename: string) => {
  if (is_prod) {
    window.location.href = "/file/" + filename;
  }
};
let del = async (filename: string) => {
  server_response = await axios.delete("/file/" + filename);
  fetchData();
};

let convert = async (filename: string) => {
  server_response = await axios.post("/convert/" + filename);
  fetchData();
};

let getLinkedFields = async (filename: string) => {
  const response = await axios.get("/get-fields/" + filename);
  linked_fields.data.push(response.data);
};

let checkfilename = function (e: Event) {
  let file = (<HTMLInputElement>e.target).files as FileList;
  if (!file[0].name.includes(".json") && !file[0].name.includes(".csv")) {
    disabledButton.value = true;
  } else {
    disabledButton.value = false;
  }
};

fetchData();
getDimensions();
</script>

<template>
  <div style="padding-top: 20px; text-align: center">
    <h2 style="margin-bottom: 0px">
      Product9 File Server
    </h2>
    <b>{{ !is_prod ? "Frontend Development Mode" : "" }}</b>
    <br><br>
    <div>
      <b>API Calls:</b>
      <br>GET <a href="/filelist">/filelist</a> <br>POST /fileupload
      <br>GET /file/:filename <br>GET
      <a href="/get-dimensions">/get-dimensions</a> <br>GET /assets/:filename
      <br>DELETE /file/:filename <br>POST /convert/:filename <br>GET
      /get-fields/:filename <br>POST /set-fields/:filename <br>GET
      /detect-fields/:filename
    </div>
    <br>
    <form
      ref="fileForm"
      style="display: inline-block"
    >
      <input
        type="file"
        name="file"
        @change="checkfilename"
      >
    </form>
    <br><br>
    <input
      type="button"
      :disabled="disabledButton"
      style="display: inline-block"
      value="Upload JSON/CSV dataset"
      @click="submitFile()"
    >
    <br><br>
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
      <button
        :disabled="!is_prod"
        @click="view(l)"
      >
        View
      </button>
      <button
        v-if="String(l).includes('.csv')"
        :disabled="!is_prod"
        @click="convert(l)"
      >
        Convert To JSON
      </button>
      <button
        v-else
        :disabled="!is_prod"
        @click="detectFields(l)"
      >
        Edit Dimensions
      </button>
      <button
        :disabled="!is_prod"
        @click="del(l)"
      >
        Delete
      </button>
      <br><br>
    </div>
  </div>
</template>
