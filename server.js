const { execSync } = require("child_process");
const requiredPackages = [
  "express",
  "body-parser",
  "fs",
  "path",
  "uuid",
  "cors",
  "https",
  "nodemon",
  "lodash",
];

function checkAndInstallPackages(packages) {
  packages.forEach((pkg) => {
    try {
      require.resolve(pkg);
    } catch (e) {
      console.log(`${pkg} is not installed. Installing...`);
      execSync(`npm install ${pkg}`, { stdio: "inherit" });
    }
  });
}

checkAndInstallPackages(requiredPackages);
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const https = require("https");
const lodash = require("lodash");
const httpsPort = 443;
const httpPort = 80;
try {
  const privateKey = fs.readFileSync("private.key", "utf8");
  const certificate = fs.readFileSync("certificate.crt", "utf8");
  let credentials;
  if (fs.existsSync("ca_bundle.crt")) {
    const ca = fs.readFileSync("ca_bundle.crt", "utf8");
    credentials = { key: privateKey, cert: certificate, ca: ca };
  } else {
    credentials = { key: privateKey, cert: certificate };
  }
  const httpsApp = express();
  const httpsServer = https.createServer(credentials, httpsApp);
  if (process.env.npm_lifecycle_script !== "nodemon") {
    console.warn("Use nodemon to run the server.");
    console.warn("Command: `npx nodemon server.js`");
    process.exit(0);
  }
  httpsServer.listen(httpsPort, () => {
    console.log(`Https server is running at https://localhost:${httpsPort}`);
  });
  httpsApp.use(cors());
  httpsApp.use(bodyParser.json());

  httpsApp.post("/exportResourcePack", (req, res) => {
    makePackRequest(req, res, "resource");
  });
  httpsApp.post("/exportBehaviourPack", (req, res) => {
    makePackRequest(req, res, "behaviour");
  });
  httpsApp.post("/exportCraftingTweak", (req, res) => {
    makePackRequest(req, res, "crafting");
  });
  httpsApp.get("/downloadTotals", (req, res) => {
    const type = req.query.type;
    if (fs.existsSync(`${cdir("base")}/downloadTotals${type}.json`)) {
        res.sendFile(`${cdir("base")}/downloadTotals${type}.json`);
    }
  });
  httpsApp.post("/update", (req, res) => {
    const key = req.query.key;
    if (!key) {
      res.send("You need a key to update the server.");
    }
    if (!fs.existsSync(secretStuffPath)) {
      const newkey = uuidv4();
      const secretStuff = { key: newkey };
      dumpJson(secretStuffPath, secretStuff);
      return res
        .status(500)
        .send("Secret stuff file not found. Made a new one.");
    }
    const secretStuff = loadJson(secretStuffPath);
    const storedkey = secretStuff.key;
    if (key === storedkey) {
      try {
        console.log("Pulling from git...");
        const gitPullOutput = execSync("git pull --rebase").toString();
        console.log("Pulled from git.");
        console.log("Updating Submodules...");
        const gitSubmoduleOutput = execSync("git submodule update").toString();
        console.log("Updated Submodules");
        const blue = "\x1b[34m";
        const gray = "\x1b[90m";
        const reset = "\x1b[0m";
        const formattedResponse = `
        ${blue}Update Successful${reset}
        ${blue}Git Pull Output:${reset}
        ${gray}${gitPullOutput}${reset}
        ${blue}Submodule Update Output:${reset}
        ${gray}${gitSubmoduleOutput}${reset}
        Do a GET /checkOnline to see the changes.
        `;
        return res.status(200).send(formattedResponse);
      } catch (error) {
        const red = "\x1b[31m";
        const gray = "\x1b[90m";
        const reset = "\x1b[0m";
        console.error("Error during git operation:", error);
        const errorResponse = `
        ${red}Error${reset}
        There was an error pulling or updating submodules.
        ${gray}${error.toString()}${reset}
        `;
        return res.status(500).send(errorResponse);
      }
    } else {
      res.send("Wrong key!");
    }
  });
  httpsApp.get("/checkOnline", (req, res) => {
    try {
      const gitLogOutput = execSync("git log -1 --format=short").toString();
      const gitSubmoduleOutput = execSync("git submodule status").toString();
      const colorizeGitLog = (log) => {
        return log
          .replace(
            /commit\s([a-f0-9]+)/,
            '<span style="color:#f14e32">commit $1</span>',
          ) // Commit hash
          .replace(
            /Author:\s(.+)/,
            '<span style="color:#1f8ee2">Author: $1</span>',
          ) // Author
          .replace(
            /Date:\s+(.+)/,
            '<span style="color:#9c9c9c">Date: $1</span>',
          );
      };
      const colorizeSubmoduleStatus = (status) => {
        return status.replace(
          /([+\-0-9a-f]{40})\s([a-zA-Z0-9\-\/]+)/g,
          '<span style="color:#f14e32">$1</span> <span style="color:#1f8ee2">$2</span>',
        );
      };
      const formattedLog = colorizeGitLog(gitLogOutput);
      const formattedSubmoduleStatus =
        colorizeSubmoduleStatus(gitSubmoduleOutput);
      res.send(`
        <h1>Server is online</h1>
        <h3>Local Repo Status</h3>
        <pre>${formattedLog}</pre>
        <h3>Submodule Status</h3>
        <pre>${formattedSubmoduleStatus}</pre>
        <style>
          @import url("https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&display=swap");
          body { font-family: "Pixelify Sans"; }
          pre { font-family: "Pixelify Sans"; background-color: #1e1e1e; padding: 10px; color: #ddd; border-radius: 5px; }
        </style>
      `);
    } catch (error) {
      console.error("Error during git commands:", error);
      res.status(500).send(`
        <h1>Error</h1>
        <p>There was an error retrieving git information.</p>
        <pre>${error.toString()}</pre>
        <style>@import url("https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&display=swap");
        body { font-family:"Pixelify Sans" }
        pre { font-family: "Pixelify Sans"; background-color: #1e1e1e; padding: 10px; color: #ddd; border-radius: 5px; }</style>
      `);
    }
  });
  httpsApp.get("*", (req, res) => {
    res.redirect("https://becomtweaks.github.io");
    console.log("Someone accesssed the IP. Rickrolled them instead.");
  });
} catch (e) {
  console.log(`HTTPS error: ${e}`);
}

const httpApp = express();

httpApp.use(cors());
httpApp.use(bodyParser.json());

let currentdir = process.cwd();
function cdir(type) {
  if (type == "resource") return currentdir + "/resource-packs";
  else if (type == "behaviour") return currentdir + "/behaviour-packs";
  else if (type == "crafting") return currentdir + "/crafting-tweaks";
  else if (type == "base") return currentdir;
  else return currentdir + "/makePacks";
}

const secretStuffPath = path.join(currentdir, "secretstuff.json");

function lsdir(directory) {
  let folderList = [];

  function traverseDir(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    entries.forEach((entry) => {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path
        .relative(directory, fullPath)
        .replace(/\\/g, "/");
      if (entry.isDirectory()) {
        folderList.push(relativePath + "/");
        traverseDir(fullPath);
      } else {
        folderList.push(relativePath);
      }
    });
  }

  traverseDir(directory);
  return folderList;
}

let mf = loadJson(`${cdir("resource")}/jsons/others/manifest.json`);
function manifestGenerator(selectedPacks, packName, type, mcVersion) {
  const regex =
    /^\d\.\d\d$|^\d\.\d\d\.\d$|^\d\.\d\d\.\d\d$|^\d\.\d\d\.\d\d\d$/gm;
  mf = loadJson(`${cdir(type)}/jsons/others/manifest.json`);
  mf.header.name = packName;
  let description = "";
  for (let i in selectedPacks) {
    if (i !== "raw" && selectedPacks[i]["packs"].length !== 0) {
      description += `\n${i}`;
      selectedPacks[i].packs.forEach((p) => {
        description += `\n\t${p}`;
      });
    }
  }
  mf.header.description = description.slice(1);
  if (regex.test(mcVersion)) {
    let splitMCVersion = [];
    console.log(`min_engine_version set to ${mcVersion}`);
    for (var i = 0; i < 3; i++) {
      if (mcVersion.split(".")[i])
        splitMCVersion[i] = parseInt(mcVersion.split(".")[i]);
      else splitMCVersion[i] = 0;
    }
    mf.header.min_engine_version = splitMCVersion;
  } else mf.header.min_engine_version = [1, 21, 0];
  mf.header.uuid = uuidv4();
  mf.modules[0].uuid = uuidv4();
  const packDir = `${cdir()}/${mf.header.name}`;
  if (!fs.existsSync(packDir)) {
    fs.mkdirSync(packDir, { recursive: true });
  }
  dumpJson(`${packDir}/manifest.json`, mf);
  fs.copyFileSync(
    `${cdir(type)}/pack_icons/pack_icon.png`,
    `${packDir}/pack_icon.png`,
  );
}

function listOfFromDirectories(selectedPacks, type) {
  selPacks = selectedPacks;
  let addedPacks = [];
  let fromDir = [];
  let priorities = [];
  const nameToJson = loadJson(
    `${cdir(type)}/jsons/others/name_to_json.json`,
  );
  const incompleteCompatibility = loadJson(
    `${cdir(type)}/jsons/others/incomplete_compatibilities.json`,
  );

  for (let category in selPacks) {
    if (category !== "raw") {
      const ctopic = loadJson(
        `${cdir(type)}/jsons/packs/${nameToJson[category]}`,
      );
      selPacks[category].packs.forEach((pack, index) => {
        let compatible = false;
        if (
          addedPacks.includes(
            ctopic.packs[selPacks[category].index[index]].pack_id,
          )
        ) {
          // This part is when compatibility for another pack
          // led this certain pack to be already added
          compatible = true;
        }
        if (!compatible) {
          try {
            ctopic.packs[selPacks[category].index[index]].compatibility.forEach(
              (k) => {
                if (selPacks.raw && selPacks.raw.includes(k) && !incompleteCompatibility[selpacks[category].packs[index]].includes(k)) {
                  // There is a pack that can use compatibilities
                  fromDir.push(
                    `${cdir(type)}/packs/${category.toLowerCase()}/${pack}/${k}`,
                  );
                  addedPacks.push(pack, k);
                  compatible = true;
                }
              },
            );
          } catch (TypeError) {
            // No compatibility key because it
            // isnt compulsory          
          }
        }
        if (!compatible) {
          // when there is no compatibility with other packs
          // so it just uses the default pack
          fromDir.push(
            `${cdir(type)}/packs/${category.toLowerCase()}/${pack}/default`,
          );
          addedPacks.push(pack);
        }
        if (ctopic.packs[selPacks[category].index[index]].priority) {
          priorities.push(
            ctopic.packs[selPacks[category].index[index]].pack_id,
          );
        }
      });
    }
  }
  return [fromDir, priorities];
}

function mainCopyFile(fromDir, priorities) {
  const fromListDir = lsdir(fromDir);
  const toDir = `${cdir()}/${mf.header.name}`;
  const toListDir = lsdir(toDir);
  fromListDir.forEach((item, index) => {
    const progress = `${fromDir.split("/").slice(-2, -1)[0]} ${index + 1}/${fromListDir.length}`;
    process.stdout.write(
      `\r${progress}${" ".repeat(process.stdout.columns - progress.length)}`,
    );

    if (item === "./") {
      return;
    }
    const targetPath = path.join(toDir, item);
    if (item.endsWith("/")) {
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath);
      }
    } else {
      if (toListDir.includes(item)) {
        if (item.endsWith(".json")) {
          const toJson = loadJson(targetPath);
          const fromJson = loadJson(path.join(fromDir, item));
          const mergedJson = lodash.merge(toJson, fromJson);
          dumpJson(targetPath, mergedJson);
        } else if (item.endsWith(".lang")) {
          const fromLang = fs.readFileSync(path.join(fromDir, item), "utf-8");
          fs.appendFileSync(targetPath, `\n${fromLang}`);
        }
        else if (priorities.includes(`${fromDir.split("/").slice(-2, -1)[0]}`)) {
          fs.copyFileSync(path.join(fromDir, item), targetPath);
        }
      } else {
        fs.copyFileSync(path.join(fromDir, item), targetPath);
      }
    }
  });
}
function exportPack(selectedPacks, packName, type, mcVersion) {
  manifestGenerator(selectedPacks, packName, type, mcVersion);
  const [fromDir, priorities]  = listOfFromDirectories(selectedPacks, type);
  console.log(`Exporting at ${cdir()}${path.sep}${mf.header.name}...`);
  fromDir.forEach((from) => mainCopyFile(from, priorities));
  const targetPackDir = `${cdir()}/${mf.header.name}`;
  console.log(`selected_packs.json 1/1`);
  fs.writeFileSync(
    path.join(targetPackDir, "selected_packs.json"),
    JSON.stringify(selectedPacks),
  );
  console.log(`${mf.header.name}.zip 1/2`);
  let command;
  if (process.platform === "win32") {
    command = `cd ${cdir()} && powershell Compress-Archive -Path "${mf.header.name}" -DestinationPath "${mf.header.name}.zip"`;
  } else {
    command = `cd "${cdir()}";zip -r "${mf.header.name}.zip" "${mf.header.name}"`;
  }
  execSync(command);
  console.log(`${mf.header.name}.mcpack 2/2`);
  fs.renameSync(
    `${path.join(cdir(), mf.header.name)}.zip`,
    `${path.join(cdir(), mf.header.name)}.mcpack`,
  );
  fs.rmSync(targetPackDir, { recursive: true });
  console.log(`Exported at ${cdir()}${path.sep}${mf.header.name}.mcpack`);
  return `${path.join(cdir(), mf.header.name)}.mcpack`;
}

function loadJson(path) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch (error) {
    console.log(error.stack, "yellow");
    process.exit(1);
  }
}

function dumpJson(path, dictionary) {
  const data = JSON.stringify(dictionary);
  fs.writeFileSync(path, data, "utf-8");
}

if (process.env.npm_lifecycle_script !== "nodemon") {
  console.warn("You are recommended to use nodemon when developing on the server.");
  console.warn("Command: `npx nodemon server.js`");
}

httpApp.listen(httpPort, () => {
  console.log(`Http server is running at http://localhost:${httpPort}`);
});

httpApp.post("/exportResourcePack", (req, res) => {
  makePackRequest(req, res, "resource");
});

httpApp.post("/exportBehaviourPack", (req, res) => {
  makePackRequest(req, res, "behaviour");
});

httpApp.post("/exportCraftingTweak", (req, res) => {
  makePackRequest(req, res, "crafting");
});

httpApp.get("/downloadTotals", (req, res) => {
  const type = req.query.type;
  if (!type) {
    res.send("You need a specified query. The only query available is `type`.");
  } else {
    if (fs.existsSync(`${cdir("base")}/downloadTotals${type}.json`)) {
      res.sendFile(`${cdir("base")}/downloadTotals${type}.json`);
    } else {
      res.send(
        `There is no such file called downloadTotals${type}.json at the root directory`,
      );
    }
  }
});

httpApp.post("/update", (req, res) => {
  res.send("Lazy ass, just do it yourself");
  console.log(
    "Hey lazy ass, over here, just press `Ctrl + C` then `git pull`, why the extra steps?",
  );
});

httpApp.get("*", (req, res) => {
  res.send(
    "There's nothing here, you should probably enter into the submodules to find the website.",
  );
});

httpApp.post("*", (req, res) => {
  res.send(
    "There's nothing here, you should probably enter into the submodules to find the website.",
  );
});

function makePackRequest(req, res, type) {
  const packName = req.headers.packname.replace(/[^a-zA-Z0-9\-_]/g, "");
  const selectedPacks = req.body;
  const mcVersion = req.headers.mcversion;
  const zipPath = exportPack(selectedPacks, packName, type, mcVersion);

  res.download(zipPath, `${path.basename(zipPath)}`, (err) => {
    if (err) {
      console.error("Error downloading the file:", err);
      try {
        res.status(500).send("Error downloading the file.");
      } catch (e) {
        console.log(e);
      }
    }
    try {
      fs.unlinkSync(zipPath);
    } catch (e) {
      console.log(e);
    }
  });

  let downloadTotals = JSON.parse("{}");
  if (fs.existsSync(`downloadTotals${type}.json`))
    downloadTotals = loadJson(`downloadTotals${type}.json`);
  if (!downloadTotals.hasOwnProperty("total")) {
    downloadTotals["total"] = 0;
  }
  downloadTotals["total"] += 1;
  for (var i in selectedPacks.raw) {
    if (!downloadTotals.hasOwnProperty(selectedPacks.raw[i])) {
      downloadTotals[selectedPacks.raw[i]] = 0;
    }
    downloadTotals[selectedPacks.raw[i]] += 1;
  }
  const sortedDownloadTotals = Object.entries(downloadTotals);
  sortedDownloadTotals.sort((a, b) => b[1] - a[1]);
  const sortedData = Object.fromEntries(sortedDownloadTotals);
  dumpJson(`downloadTotals${type}.json`, sortedData);
}
