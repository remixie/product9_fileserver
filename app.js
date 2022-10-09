const express = require("express");
const multer = require("multer");
const app = express();
const path = require("path");
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
  res.sendFile(path.join(__dirname, "public/index.html"));
});
app.listen(5000, console.log("Listening on port 5000"));
