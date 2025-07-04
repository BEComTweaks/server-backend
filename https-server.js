const https = require("https");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const filesystem = require("fs");
const acceptableHttpsPorts = [443, 8443, 8444];
function initHttpsServer() {
    let httpsPortIndex = 0;
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
        httpsApp.use(cors());
        httpsApp.use(bodyParser.json());
        const httpsServer = https.createServer(credentials, httpsApp);
        startHttpsServer(acceptableHttpsPorts[0]);

        function startHttpsServer(port) {
            console.log(`Starting HTTPS server on port ${port}...`);
            httpsServer.listen(port);
        }
        httpsServer.on('listening', () => {
            const port = httpsServer.address().port;
            console.log(`Https server is running at https://localhost:${port}`);
        });
        httpsServer.on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                console.log(`Port ${e.port} is already in use.`);
                changePort();
            } else if (e.code === 'EACCES') {
                console.log(`Permission denied to use HTTPS port ${e.port}`);
                changePort();
            } else {
                console.log(`Error with HTTPS server:`, e.message);
            }

        });
        function changePort() {
            httpsPortIndex++;
            if (httpsPortIndex < acceptableHttpsPorts.length) {
                const nextPort = acceptableHttpsPorts[httpsPortIndex];
                console.log(`Trying next port: ${nextPort}`);
                startHttpsServer(nextPort);
            } else {
                console.error("No more acceptable HTTPS ports available.");
            }
        }
        return httpsApp
    } catch (e) {
        console.log(`HTTPS error: ${e}`);
    }
}
module.exports = {
    initHttpsServer
}