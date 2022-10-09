import express from "express";
import multer from "multer";
const app = express();
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fileStorageEngine = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "--" + file.originalname);
  },
});
const upload = multer({
  storage: fileStorageEngine,
});
app.post("/fileupload", upload.array("binary", 2), (req, res) => {
  //console.log(req.files);
  res.send("File(s) Uploaded.");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/index.html"));
});

app.get("/assets/:file", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/assets/" + req.params.file));
});

app.listen(5000, console.log("Listening on port 5000"));
