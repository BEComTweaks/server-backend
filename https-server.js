const https = require("https");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const filesystem = require("fs");
let httpsPortIndex = 0;
const acceptableHttpsPorts = [443, 8443, 8444];
// Attempt to start https server
function initHttpsServer() {
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
        if (process.env.npm_lifecycle_script !== "nodemon") {
            console.warn("Use nodemon to run the server.");
            console.warn("Command: `npx nodemon server.js`");
            // process.exit(0);
        }
        const httpsServer = https.createServer(credentials, httpsApp);
        httpsServer.on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                console.log(`Port ${e.port} is already in use.`);
            } else {
                console.log(`Error starting HTTPS server:`, e.message);
            }

            httpsPortIndex++;
            if (httpsPortIndex < acceptableHttpsPorts.length) {
                const nextPort = acceptableHttpsPorts[httpsPortIndex];
                console.log(`Trying next port: ${nextPort}`);
                startHttpsServer(nextPort);
            } else {
                console.error("No more acceptable HTTPS ports available.");
                process.exit(1);
            }
        });

        startHttpsServer(acceptableHttpsPorts[0]);

        function startHttpsServer(port) {
            console.log(`Starting HTTPS server on port ${port}...`);
            httpsServer.listen(port);
        }
        httpsServer.on('listening', () => {
            const port = httpsServer.address().port;
            console.log(`Https server is running at https://localhost:${port}`);
        });
        httpsApp.use(cors());
        httpsApp.use(bodyParser.json());
        return httpsApp
    } catch (e) {
        console.log(`HTTPS error: ${e}`);
    }
}
module.exports = {
    initHttpsServer
}