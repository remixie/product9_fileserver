import express from "express";
const app = express();
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import busboy from "connect-busboy";

app.use(
  busboy({
    highWaterMark: 100 * 1024 * 1024, // Set 100MiB buffer
  })
);
app.post("/fileupload", async function (req, res) {
  req.pipe(req.busboy);

  req.busboy.on("file", (fieldname, file, info) => {
    const filename = info.filename;
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
      console.log(`Upload of '${filename}' finished`);
      res.redirect("/");
    });
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

app.delete("/file/:file", (req, res) => {
  fs.unlink("uploads/" + req.params.file, function () {
    console.log(req.params.file + " has been deleted!");
  });
  res.sendStatus(200);
});

app.listen(5000, console.log("Listening on port 5000"));
