import express from "express";
const app = express();
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import busboy from "connect-busboy";
import AWS from "aws-sdk";
import csv from "csvtojson";

import * as jsonpatch from "fast-json-patch/index.mjs";

var s3 = new AWS.S3({
  endpoint: "s3.us-west-004.backblazeb2.com",
  region: "us-west-004",
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

function extension(filename) {
  return filename.match(/\.[0-9a-z]+$/i)[0];
}

app.use(express.json());
app.use(
  busboy({
    highWaterMark: 10000 * 1024 * 1024, // Set 10000MiB buffer
  })
);
app.post("/fileupload", async function (req, res) {
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
  req.pipe(req.busboy);
});

app.get("/filelist", async (_req, res) => {
  let list = [];
  let files = await fs.promises.readdir(path.resolve(__dirname, "uploads"));

  files.sort((a, b) => {
    if (extension(a) > extension(b)) {
      return -1;
    }
    if (extension(a) < extension(b)) {
      return 1;
    }
    return 0;
  });

  for (let file of files) {
    list.push(file);
  }

  res.send(list);
});

app.get("/", (_req, res) => {
  var params = {
    Bucket: process.env.BUCKET_NAME,
    Key: "test.txt",
    Body: "Hello World!",
  };
  s3.putObject(params, function (err, data) {
    if (err) console.log(err);
    else
      console.log(
        "Successfully uploaded data to " +
          process.env.BUCKET_NAME +
          "/" +
          "text.txt"
      );
  });

  res.sendFile(path.join(__dirname, "dist/index.html"));
});

app.get("/assets/:filename", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/assets/" + req.params.filename));
});

app.get("/file/:filename", (req, res) => {
  res.sendFile(path.join(__dirname, "uploads/" + req.params.filename));
});

function deletedMsg(req, res) {
  console.log(req.params.filename + " has been deleted.");
  res.send(req.params.filename + " has been deleted.");
}

app.delete("/file/:filename", (req, res) => {
  fs.unlink("uploads/" + req.params.filename, () => deletedMsg(req, res));
});

app.post("/convert/:filename", async function (req, res) {
  if (extension(req.params.filename) === ".csv") {
    const readStream = fs.createReadStream(
      path.join(__dirname, "uploads/" + req.params.filename)
    );
    const writeStream = fs.createWriteStream(
      __dirname +
        "/uploads/" +
        req.params.filename.replace(".csv", "-generated.json")
    );
    await readStream.pipe(csv({ downstreamFormat: "array" })).pipe(writeStream);

    console.log(req.params.filename + " has been converted!");
    res.send(req.params.filename + " has been converted!");
  }
});

import metadata from "./metadata/setfields.json" assert { type: "json" };
app.get("/get-fields/:filename", async (req, res) => {
  res.send(
    metadata.data.filter((data) => data.id === req.params.filename)[0]
      ?.attributes
  );
});

app.post("/set-fields/:filename", async (req, res) => {
  if (req.body.includes(null)) {
    res.send("All dimensions must be set with a field.");
  } else {
    let op = "add";
    if (
      Object.values(metadata.data).filter(
        (data) => data.id == req.params.filename
      ).length
    ) {
      op = "replace";
    }

    const patch = [
      {
        op,
        path: "/data/",
        value: {
          id: req.params.filename,
          attributes: {
            x: req.body[0],
            y: req.body[1],
            z: req.body[2],
            color: req.body[3],
            size: req.body[4],
          },
        },
      },
    ];
    let new_metadata = jsonpatch.applyPatch(metadata, patch).newDocument;
    const fstream = fs.createWriteStream(
      __dirname + "/metadata/setfields.json"
    );
    fstream.write(JSON.stringify(new_metadata));
    res.send("Saved fields as dimensions for " + req.params.filename);
  }
});

import dimensions from "./metadata/dimensions.json" assert { type: "json" };
app.get("/get-dimensions", (_req, res) => {
  res.send(dimensions);
});

app.get("/detect-fields/:filename", async (req, res) => {
  if (extension(req.params.filename) === ".json") {
    const fstream = await fs.createReadStream(
      path.join(__dirname, "uploads/" + req.params.filename),
      {
        start: 0,
        end: 5000, //find all fields within the first 5000 characters
      }
    );
    let data = "";

    fstream.on("readable", function () {
      //basically loop until you find an ending } in a chunk

      let chunk;

      while ((chunk = fstream.read()) !== null) {
        data = chunk.toString();

        while (data.match(/{(.|\n|\r)+}(?=,(\s)+{)/g)) {
          data = data.match(/{(.|\n|\r)+}(?=,(\s)+{)/g)[0].toString();
        }
        data = JSON.parse(data);
      }
    });

    fstream.on("end", () => {
      res.send(
        Object.entries(data).map((d) => {
          return d[0];
        })
      );
    });
  }
});

var port = process.env.PORT || 5000;

app.listen(port, console.log("Listening on port " + port));
