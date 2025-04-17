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
const filesystem = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const https = require("https");
const lodash = require("lodash");
const httpsPort = 443;
const httpPort = 80;


let currentdir = process.cwd();
function cdir(type) {
  if (type == "resource") return currentdir + "/resource-packs";
  else if (type == "behaviour") return currentdir + "/behaviour-packs";
  else if (type == "crafting") return currentdir + "/crafting-tweaks";
  else if (type == "base") return currentdir;
  else return currentdir + "/makePacks";
}

// Rebuild everything when you start the server
console.log("Rebuilding...");
console.log("Rebuilding resource packs...");
process.chdir(`${cdir("base")}/resource-packs`);
try {
  execSync("python pys/pre_commit.py --no-stash --build server --no-spinner --format", { stdio: "inherit" });
  execSync("git add .");
} catch (error) {
  console.error("Error during resource pack rebuild:", error.message);
  process.exit(1);
}
console.log("Rebuilding behaviour packs...");
process.chdir(`${cdir("base")}/behaviour-packs`);
try {
  execSync("python pys/pre_commit.py --no-stash --build server --no-spinner --format", { stdio: "inherit" });
  execSync("git add .");
} catch (error) {
  console.error("Error during behaviour pack rebuild:", error.message);
  process.exit(1);
}

console.log("Rebuilding crafting tweaks...");
process.chdir(`${cdir("base")}/crafting-tweaks`);
try {
  execSync("python pys/pre_commit.py --no-stash --build server --no-spinner --format", { stdio: "inherit" });
  execSync("git add .");
} catch (error) {
  console.error("Error during crafting tweaks rebuild:", error.message);
  process.exit(1);
}

process.chdir(currentdir);

// Leads to times where you just cant pull even with rebase because git is just lovely
console.log("Rebuild complete! Setting up server...");

// Attempt to start https server
try {
  const privateKey = filesystem.readFileSync("private.key", "utf8");
  const certificate = filesystem.readFileSync("certificate.crt", "utf8");
  let credentials;
  if (filesystem.existsSync("ca_bundle.crt")) {
    const ca = filesystem.readFileSync("ca_bundle.crt", "utf8");
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
    if (filesystem.existsSync(`${cdir("base")}/downloadTotals${type}.json`)) {
      res.sendFile(`${cdir("base")}/downloadTotals${type}.json`);
    }
  });
  httpsApp.post("/update", (req, res) => {
    const key = req.query.key;
    if (!key) {
      res.send("You need a key to update the server.");
    }
    if (!filesystem.existsSync(secretStuffPath)) {
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
    console.log("Someone accesssed the IP. Redirected them to the correct site.");
  });
} catch (e) {
  console.log(`HTTPS error: ${e}`);
}

// damn have to use http
const httpApp = express();

httpApp.use(cors());
httpApp.use(bodyParser.json());

const secretStuffPath = path.join(currentdir, "secretstuff.json");

function lsdir(directory) {
  let folderList = [];

  function traverseDir(currentDir) {
    const entries = filesystem.readdirSync(currentDir, { withFileTypes: true });
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

let realManifest;

function newGenerator(selectedPacks, packName, type, mcVersion) {
  if (type == "behaviour") {
    defaultFileGenerator(selectedPacks, packName, type, mcVersion, "bp");
  } else {
    defaultFileGenerator(selectedPacks, packName, type, mcVersion);
  }
  console.log(`Generated default files for ${packName}`);
  const [fromDir, priorities] = listOfFromDirectories(selectedPacks, type);
  console.log([fromDir, priorities]);
  console.log(`Obtained list of directories and priorities`);
  console.log(
    `Exporting at ${cdir()}${path.sep}${realManifest.header.name}...`,
  );
  mainCopyFile(fromDir, priorities);
  console.log(`Copied necessary files`);
  console.log(`${realManifest.header.name}.zip 1/2`);
  let command;
  if (process.platform === "win32") {
    command = `cd ${cdir()} && powershell Compress-Archive -Path "${realManifest.header.name}" -DestinationPath "${realManifest.header.name}.zip"`;
  } else {
    command = `cd "${cdir()}";zip -r "${realManifest.header.name}.zip" "${realManifest.header.name}"`;
  }
  execSync(command);
  let extension;
  if (type == "behaviour") {
    extension = "mcaddon";
  } else {
    extension = "mcpack";
  }
  console.log(`${realManifest.header.name}.${extension} 2/2`);
  filesystem.renameSync(
    `${path.join(cdir(), realManifest.header.name)}.zip`,
    `${path.join(cdir(), realManifest.header.name)}.${extension}`,
  );
  filesystem.rmSync(`${cdir()}/${realManifest.header.name}`, {
    recursive: true,
  });
  console.log(
    `Exported at ${cdir()}${path.sep}${realManifest.header.name}.${extension}`,
  );
  return `${path.join(cdir(), realManifest.header.name)}.${extension}`;
}

function defaultFileGenerator(
  selectedPacks,
  packName,
  type,
  mcVersion,
  extra_dir = undefined,
) {
  // generate the manifest
  const regex =
    /^\d\.\d\d$|^\d\.\d\d\.\d$|^\d\.\d\d\.\d\d$|^\d\.\d\d\.\d\d\d$/gm;
  templateManifest = loadJson(`${cdir(type)}/jsons/manifest.json`);
  templateManifest.header.name = packName;
  let description = "";
  for (let i in selectedPacks) {
    if (i !== "raw" && selectedPacks[i].length !== 0) {
      description += `\n${i}`;
      selectedPacks[i].forEach((p) => {
        description += `\n\t${p}`;
      });
    }
  }
  templateManifest.header.description = description.slice(1);
  if (regex.test(mcVersion)) {
    let splitMCVersion = [];
    console.log(`min_engine_version set to ${mcVersion}`);
    for (var i = 0; i < 3; i++) {
      if (mcVersion.split(".")[i])
        splitMCVersion[i] = parseInt(mcVersion.split(".")[i]);
      else splitMCVersion[i] = 0;
    }
    templateManifest.header.min_engine_version = splitMCVersion;
  } else templateManifest.header.min_engine_version = [1, 21, 0];
  templateManifest.header.uuid = uuidv4();
  templateManifest.modules[0].uuid = uuidv4();
  let packDir;
  if (extra_dir !== undefined) {
    packDir = `${cdir()}/${packName}/${extra_dir}`;
  } else {
    packDir = `${cdir()}/${templateManifest.header.name}`;
  }
  if (!filesystem.existsSync(packDir)) {
    filesystem.mkdirSync(packDir, { recursive: true });
  }
  dumpJson(`${packDir}/manifest.json`, templateManifest);
  realManifest = templateManifest;

  // add the pack icon
  filesystem.copyFileSync(
    `${cdir(type)}/pack_icons/pack_icon.png`,
    `${packDir}/pack_icon.png`,
  );
  // add the selected packs for the easy selecting from site
  dumpJson(`${packDir}/selected_packs.json`, selectedPacks);
}

function listOfFromDirectories(selectedPacks, type) {
  let addedPacks = [];
  let addedPacksPriority = []; // mapped priority of the fromDir
  let fromDir = [];
  let addedCompatibilitiesPacks = []; // doesnt require priority, just exists for checking purposes

  const nameToJson = loadJson(`${cdir(type)}/jsons/map/name_to_json.json`);
  const priorityMap = loadJson(`${cdir(type)}/jsons/map/priority.json`);
  const compatibilities = loadJson(
    `${cdir(type)}/jsons/map/compatibility.json`,
  );
  const comp_file = loadJson(`${cdir(type)}/jsons/packs/compatibilities.json`);
  const max_comps = comp_file["max_simultaneous"];

  for (let n = max_comps; n >= 2; n--) {
    // for the love of god, change the key
    compatibilities[`${n}way`].forEach((compatibility) => {
      // check for compatibilities
      let useThisCompatibility = true;
      compatibility.forEach((packToCheck) => {
        if (
          !selectedPacks.raw.includes(packToCheck) ||
          addedCompatibilitiesPacks.includes(packToCheck)
        ) {
          useThisCompatibility = false;
        }
      });
      if (useThisCompatibility) {
        // get index in defs
        const thisDefinedCompatibility = comp_file[`${n}way`][compatibilities[`${n}way`].indexOf(compatibility)];
        console.log(thisDefinedCompatibility);
        // check if you should overwrite
        if (thisDefinedCompatibility.overwrite) {
          // ignore adding respective packs
          addedPacks.push(...compatibility);
        }
        addedCompatibilitiesPacks.push(...compatibility)
        addedPacksPriority.push(999); // compatibilities shouldnt be affected by priorities
        fromDir.push(`${cdir(type)}/packs/${thisDefinedCompatibility.location}`);
      }
    });
  }

  const categoryKeys = Object.keys(selectedPacks);
  categoryKeys.forEach((category) => {
    if (category === "raw") {
      return;
    } else {
      const currentCategoryJSON = loadJson(
        `${cdir(type)}/jsons/packs/${nameToJson[category]}`,
      );
      let location;
      if (currentCategoryJSON.location === undefined) {
        location = currentCategoryJSON.topic;
        location = location.toLowerCase();
      } else {
        location = currentCategoryJSON.location;
      }
      selectedPacks[category].forEach((pack) => {
        if (addedPacks.includes(pack)) {
          return;
        }
        addedPacks.push(pack);
        fromDir.push(`${cdir(type)}/packs/${location}/${pack}/files`);
        addedPacksPriority.push(priorityMap[pack]);
      });
    }
  });

  return [fromDir, addedPacksPriority];
}

function mainCopyFile(fromDir, priorities) {
  let addedFiles = [];
  let addedFilesPriority = [];
  fromDir.forEach((dir, dirIndexed) => {
    const fromDirRecursive = lsdir(dir);
    fromDirRecursive.forEach((item, itemIndexed) => {
      const progress = `${dir.split("/").slice(-2)[0]} ${itemIndexed + 1}/${fromDirRecursive.length}`;
      process.stdout.write(
        `\r${progress}${" ".repeat(process.stdout.columns - progress.length)}`,
      );

      // skip the root directory
      if (item === "./") {
        return;
      }
      const targetPath = path.join(cdir(), realManifest.header.name, item);
      if (item.endsWith("/")) {
        // create directory if it doesnt exist
        if (!filesystem.existsSync(targetPath)) {
          filesystem.mkdirSync(targetPath, { recursive: true });
        }
      } else {
        // is a file
        if (addedFiles.includes(item)) {
          // already exists
          if (item.endsWith(".json")) {
            const alreadyExistingJson = loadJson(targetPath);
            const newJson = loadJson(path.join(dir, item));
            const mergedJson = lodash.merge(newJson, alreadyExistingJson);
            dumpJson(targetPath, mergedJson);
          } else if (
            item.endsWith(".lang") ||
            item.endsWith(".mcfunction") ||
            item.endsWith(".txt") ||
            item.endsWith(".js")
          ) {
            // usually plaintext without needing proper formatting
            const newFileToMerge = filesystem.readFileSync(
              path.join(dir, item),
              "utf-8",
            );
            filesystem.appendFileSync(targetPath, `\n${newFileToMerge}`);
          } else if (
            priorities[dirIndexed] >
            addedFilesPriority[addedFiles.indexOf(item)]
          ) {
            // binary files, usually images
            filesystem.copyFileSync(path.join(dir, item), targetPath);
            addedFilesPriority[addedFiles.indexOf(item)] =
              priorities[dirIndexed];
          }
        } else {
          filesystem.copyFileSync(path.join(dir, item), targetPath);
          priorities.push(priorities[dirIndexed]);
          addedFiles.push(item);
        }
      }
    });
  });
}

function loadJson(path) {
  try {
    return JSON.parse(filesystem.readFileSync(path, "utf8"));
  } catch (error) {
    console.log(error.stack, "yellow");
    process.exit(1);
  }
}

function dumpJson(path, dictionary) {
  const data = JSON.stringify(dictionary);
  filesystem.writeFileSync(path, data, "utf-8");
}

if (process.env.npm_lifecycle_script !== "nodemon") {
  console.warn(
    "You are recommended to use nodemon when developing on the server.",
  );
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
    if (filesystem.existsSync(`${cdir("base")}/downloadTotals${type}.json`)) {
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
  const zipPath = newGenerator(selectedPacks, packName, type, mcVersion);

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
      filesystem.unlinkSync(zipPath);
    } catch (e) {
      console.log(e);
    }
  });

  let downloadTotals = JSON.parse("{}");
  if (filesystem.existsSync(`downloadTotals${type}.json`))
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
