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
const filesystem = require("fs");
const path = require("path");
const { makePackRequest, cdir } = require('./packCreation')
const httpsApp = require('./https-server').initHttpsServer()
const httpApp = require('./http-server').initHttpServer()
const currentdir = process.cwd();
const secretStuffPath = path.join(currentdir, "secretstuff.json");
const { v4: uuidv4 } = require("uuid");

const args = process.argv;

if (!args.includes("--no-rebuild")) {
  /* Rebuild everything when you start the server */
  console.log("Rebuilding...");
  console.log("Rebuilding resource packs...");
  process.chdir(`${cdir("base")}/resource-packs`);
  try {
    execSync(
      "python pys/pre_commit.py --no-stash --build server --no-spinner --format",
      { stdio: "inherit" },
    );
    execSync("git add .");
  } catch (error) {
    console.error("Error during resource pack rebuild:", error.message);
    process.exit(1);
  }
  console.log("Rebuilding behaviour packs...");
  process.chdir(`${cdir("base")}/behaviour-packs`);
  try {
    execSync(
      "python pys/pre_commit.py --no-stash --build server --no-spinner --format",
      { stdio: "inherit" },
    );
    execSync("git add .");
  } catch (error) {
    console.error("Error during behaviour pack rebuild:", error.message);
    process.exit(1);
  }

  console.log("Rebuilding crafting tweaks...");
  process.chdir(`${cdir("base")}/crafting-tweaks`);
  try {
    execSync(
      "python pys/pre_commit.py --no-stash --build server --no-spinner --format",
      { stdio: "inherit" },
    );
    execSync("git add .");
  } catch (error) {
    console.error("Error during crafting tweaks rebuild:", error.message);
    process.exit(1);
  }
  process.chdir(currentdir);
  console.log("Rebuild complete! Setting up server...");
}

if (process.env.npm_lifecycle_script !== "nodemon") {
  console.warn(
    "You are recommended to use nodemon when developing on the server.",
  );
  console.warn("Command: `npx nodemon server.js`");
}

httpApp.post("/exportResourcePack", (req, res) => {
  makePackRequest(req, res, "resource", args);
});
httpApp.post("/exportBehaviourPack", (req, res) => {
  makePackRequest(req, res, "behaviour", args);
});
httpApp.post("/exportCraftingTweak", (req, res) => {
  makePackRequest(req, res, "crafting", args);
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
httpApp.get("/ping", (req, res) => {
  res.send("pong?");
});
httpApp.get("/{*splat}", (req, res) => {
  res.send(
    "There's nothing here, you should probably enter into the submodules to find the website.",
  );
});
if (httpsApp) {
  httpsApp.post("/exportResourcePack", (req, res) => {
    makePackRequest(req, res, "resource", args);
  });
  httpsApp.post("/exportBehaviourPack", (req, res) => {
    makePackRequest(req, res, "behaviour", args);
  });
  httpsApp.post("/exportCraftingTweak", (req, res) => {
    makePackRequest(req, res, "crafting", args);
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
  httpsApp.get("/ping", (req, res) => {
    res.send("Pong!");
  });
  httpsApp.get("/{*splat}", (req, res) => {
    res.redirect("https://becomtweaks.github.io");
    console.log(
      "Someone accesssed the IP. Redirected them to the correct site.",
    );
  });
}