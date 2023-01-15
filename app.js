import express from "express";
const app = express();
import path from "path";
import fs from "fs";
import { Readable } from "node:stream";
import { fileURLToPath } from "url";
import { Upload } from "@aws-sdk/lib-storage";
import {
  ListObjectsCommand,
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import busboy from "connect-busboy";
import csv from "csvtojson";

import * as jsonpatch from "fast-json-patch/index.mjs";

let client = new S3Client({
  endpoint: process.env.ENDPOINT,
  region: process.env.REGION,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
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
  req.busboy.on("file", async (_fieldname, file, info) => {
    const filename = info.filename;

    if (extension(filename) === ".csv" || extension(filename) === ".json") {
      console.log(`Upload of '${filename}' started`);

      const upload = new Upload({
        client,
        queueSize: 4, // optional concurrency configuration
        leavePartsOnError: false, // optional manually handle dropped parts
        params: { Bucket: process.env.BUCKET_NAME, Key: filename, Body: file },
      });

      upload.on("httpUploadProgress", (progress) => {
        console.log(progress);
      });

      await upload.done();

      res.send(filename + " uploaded.");
    } else {
      res.send("ERROR: Invalid File Type. Upload only .json or .csv files.");
    }
  });
  req.pipe(req.busboy);
});

app.get("/filelist", async (_req, res) => {
  let list = [];

  let files = await client.send(
    new ListObjectsCommand({
      Bucket: process.env.BUCKET_NAME,
    })
  );
  //console.log(files.Contents.map((x) => x.Key));
  files = files.Contents.map((x) => x.Key);
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
  res.sendFile(path.join(__dirname, "dist/index.html"));
});

app.get("/assets/:filename", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/assets/" + req.params.filename));
});

app.get("/file/:filename", (req, res) => {
  res.redirect(
    "https://" +
      process.env.BUCKET_NAME +
      ".s3." +
      process.env.REGION +
      ".backblazeb2.com/" +
      req.params.filename
  );
});

function deletedMsg(req, res) {
  console.log(req.params.filename + " has been deleted.");
  res.send(req.params.filename + " has been deleted.");
}

app.delete("/file/:filename", async (req, res) => {
  //fs.unlink("uploads/" + req.params.filename, () => deletedMsg(req, res));

  const command = new DeleteObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: req.params.filename,
  });
  await client.send(command);

  deletedMsg(req, res);
});

const bufferToReadable = (buffer) => {
  const readable = new Readable();
  let index = 0;
  readable._read = () => {
    if (index >= buffer.length) {
      readable.push(null);
      return;
    }
    const chunk = buffer.slice(index, index + 1024);
    index += chunk.length;
    readable.push(chunk);
  };
  return readable;
};

app.post("/convert/:filename", async function (req, res) {
  if (extension(req.params.filename) === ".csv") {
    const buffer = Buffer.concat(
      await (
        await client.send(
          new GetObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: req.params.filename,
          })
        )
      ).Body.toArray()
    );

    const readable = bufferToReadable(buffer);

    let jsonStream = readable.pipe(csv());

    let jsonData = "";
    jsonStream.on("data", (chunk) => {
      jsonData += chunk.toString();
    });
    jsonStream.on("end", async () => {
      await client.send(
        new PutObjectCommand({
          Bucket: process.env.BUCKET_NAME,
          Key: req.params.filename.replace(".csv", "-generated.json"),
          Body: jsonData,
          ContentType: "application/json",
        })
      );
      console.log(req.params.filename + " has been converted!");
      res.send(req.params.filename + " has been converted!");
    });
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
