import express from "express";
const app = express();
import path from "path";
import { Readable } from "node:stream";
import { fileURLToPath } from "url";
import { Upload } from "@aws-sdk/lib-storage";
import { isNil, isEmpty } from "ramda";
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
  let matches = filename.match(/\.[0-9a-z]+$/i);
  if (!isEmpty(matches)) {
    return matches[0];
  } else {
    return "";
  }
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
      let ContentType = "application/json";
      if (extension(filename) === ".csv") {
        ContentType = "text/csv";
      }

      const upload = new Upload({
        client,
        queueSize: 4, // optional concurrency configuration
        leavePartsOnError: false, // optional manually handle dropped parts
        params: {
          Bucket: process.env.BUCKET_NAME,
          Key: filename,
          Body: file,
          ContentType,
        },
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

app.get("/filelist/:filetype?", async (req, res) => {
  let list = [];

  let files = await client.send(
    new ListObjectsCommand({
      Bucket: process.env.BUCKET_NAME,
    })
  );
  if (!isNil(files.Contents)) {
    files = files.Contents.map((x) => x.Key);
    files = files.filter((x) => !x.includes("metadata/"));
    if (!isNil(req.params.filetype)) {
      console.log(typeof req.params.filetype.toString());
      console.log(typeof "json");
      if (req.params.filetype.toString() === "json") {
        files = files.filter(
          (x) => extension(x) === "." + req.params.filetype.toString()
        );
      }
    }
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
  }
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

const makeReadable = async (filename) => {
  const buffer = Buffer.concat(
    await (
      await client.send(
        new GetObjectCommand({
          Bucket: process.env.BUCKET_NAME,
          Key: filename,
        })
      )
    ).Body.toArray()
  );

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
    const readable = await makeReadable(req.params.filename);

    let jsonStream = readable.pipe(csv({ downstreamFormat: "array" }));

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

app.get("/get-fields/:filename", async (req, res) => {
  const readable = await makeReadable("metadata/setfields.json");
  let metadata = "";
  readable.on("data", (chunk) => {
    metadata += chunk;
  });

  readable.on("end", () => {
    metadata = JSON.parse(metadata);
    res.send(
      metadata.data.filter((data) => data.id === req.params.filename)[0]
        ?.attributes
    );
  });
});

app.post("/set-fields/:filename", async (req, res) => {
  if (req.body.includes(null)) {
    res.send("All dimensions must be set with a field.");
  } else {
    const readable = await makeReadable("metadata/setfields.json");
    let metadata = "";
    readable.on("data", (chunk) => {
      metadata += chunk;
    });

    readable.on("end", async () => {
      metadata = JSON.parse(metadata);

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

      await client.send(
        new PutObjectCommand({
          Bucket: process.env.BUCKET_NAME,
          Key: "metadata/setfields.json",
          Body: JSON.stringify(new_metadata),
          ContentType: "application/json",
        })
      );

      res.send("Saved fields as dimensions for " + req.params.filename);
    });
  }
});

app.get("/get-dimensions", async (_req, res) => {
  const readable = await makeReadable("metadata/dimensions.json");
  let dimensions = "";
  readable.on("data", (chunk) => {
    dimensions += chunk;
  });

  readable.on("end", () => {
    dimensions = JSON.parse(dimensions);
    res.send(dimensions);
  });
});

app.get("/detect-fields/:filename", async (req, res) => {
  if (extension(req.params.filename) === ".json") {
    const readable = await makeReadable(req.params.filename);

    const uniqueProperties = new Set();

    //let jsonStream = readable.pipe(csv());
    let data = "";
    readable.on("data", (chunk) => {
      data += chunk;
    });

    readable.on("end", () => {
      let i = 0;
      while (i < 1000) {
        try {
          data = JSON.parse(data + "]");
          //console.log(jsonData);
          break;
        } catch (err) {
          //if it throws an error, remove the last character and try parsing again
          const cleanedString = data.slice(0, -1);
          data = cleanedString;
          i++;
        }
      }
      if (i === 1000) {
        console.log("Couldn't parse json after 1000 iterations");
      }

      for (const property in data[0]) {
        uniqueProperties.add(property);
      }
      const uniquePropertiesArray = Array.from(uniqueProperties);

      res.send(uniquePropertiesArray);
    });
  }
});

var port = process.env.PORT || 5000;

app.listen(port, console.log("Listening on port " + port));
