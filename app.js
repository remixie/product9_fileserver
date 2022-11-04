import express from "express";
const app = express();
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import busboy from "connect-busboy";
import csv from "csvtojson";

function extension(filename) {
  return filename.match(/\.[0-9a-z]+$/i)[0];
}
app.use(
  busboy({
    highWaterMark: 100 * 1024 * 1024, // Set 100MiB buffer
  })
);
app.post("/fileupload", async function (req, res) {
  req.pipe(req.busboy);
  req.busboy.on("file", (_fieldname, file, info) => {
    const filename = info.filename;
    if (extension(filename) === ".csv" || extension(filename) === ".json") {
      console.log(`Upload of '${filename}' started`);
      const fstream = fs.createWriteStream(__dirname + "/uploads/" + filename);
      file.pipe(fstream);

      /*fstream.on("drain", () => {
      const written = parseInt(fstream.bytesWritten);
      const total = parseInt(req.headers["content-length"]);
      const pWritten = ((written / total) * 100).toFixed(2);
      console.log(`Processing ${filename} ...  ${pWritten}% done`);
    });*/

      fstream.on("close", () => {
        console.log(filename + " uploaded.");
        res.send(filename + " uploaded.");
      });
    } else {
      res.send("ERROR: Invalid File Type. Upload only .json or .csv files.");
    }
  });
});

app.get("/filelist", async (_req, res) => {
  let list = [];
  let files = await fs.promises.readdir(path.resolve(__dirname, "uploads"));

  for (let file of files) {
    list.push(file);
  }

  res.send(list);
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist/index.html"));
});

app.get("/assets/:file", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/assets/" + req.params.file));
});

app.get("/file/:file", (req, res) => {
  res.sendFile(path.join(__dirname, "uploads/" + req.params.file));
});

function deletedMsg(req, res) {
  console.log(req.params.file + " has been deleted.");
  res.send(req.params.file + " has been deleted.");
}

app.delete("/file/:file", (req, res) => {
  fs.unlink("uploads/" + req.params.file, () => deletedMsg(req, res));
});

app.post("/convert/:file", async function (req, res) {
  if (extension(req.params.file) === ".csv") {
    /*const jsonArray = await csv().fromFile(
      path.join(__dirname, "uploads/" + req.params.file)
    );*/
    const readStream = fs.createReadStream(
      path.join(__dirname, "uploads/" + req.params.file)
    );
    const writeStream = fs.createWriteStream(
      __dirname +
        "/uploads/" +
        req.params.file.replace(".csv", "-generated.json")
    );
    await readStream.pipe(csv({ downstreamFormat: "array" })).pipe(writeStream);

    console.log(req.params.file + " has been converted!");
    res.send(req.params.file + " has been converted!");
  }
});

app.get("/detect-markers/:file", async (req, res) => {
  if (extension(req.params.file) === ".json") {
    const fstream = await fs.createReadStream(
      path.join(__dirname, "uploads/" + req.params.file),
      {
        start: 0,
        end: 5000,
      }
    );
    let data = "";

    fstream.on("readable", function () {
      //basically loop until you find an ending } in a chunk

      let chunk;

      while (null !== (chunk = fstream.read())) {
        data = chunk.toString();

        while (data.match(/{(.|\n|\r)+}(?=,(\s)+{)/g)) {
          data = data.match(/{(.|\n|\r)+}(?=,(\s)+{)/g)[0].toString();
        }
        data = JSON.parse(data);
      }
    });

    fstream.on("end", () => {
      res.send(Object.entries(data));
    });
  }
});

var port = process.env.PORT || 5000;

app.listen(port, console.log("Listening on port " + port));
