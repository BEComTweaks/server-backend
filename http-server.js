const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
let httpPortIndex = 0;
const acceptableHttpPorts = [80, 8080, 8000];
// damn have to use http
function initHttpServer(){
    const httpApp = express();

    httpApp.use(cors());
    httpApp.use(bodyParser.json());
    const httpServer = http.createServer(httpApp);
    httpServer.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.log(`Port ${e.port} is already in use.`);
        } else {
            console.log(`Error starting HTTP server:`, e.message);
        }

        httpPortIndex++;
        if (httpPortIndex < acceptableHttpPorts.length) {
            const nextPort = acceptableHttpPorts[httpPortIndex];
            console.log(`Trying next port: ${nextPort}`);
            startHttpServer(nextPort);
        } else {
            console.error("No more acceptable HTTP ports available.");
            process.exit(1);
        }
    });

    startHttpServer(acceptableHttpPorts[0]);

    function startHttpServer(port) {
        console.log(`Starting HTTP server on port ${port}...`);
        httpServer.listen(port);
    }
    httpServer.on('listening', () => {
        const port = httpServer.address().port;
        console.log(`Http server is running at http://localhost:${port}`);
    });
    return httpApp
}
module.exports={
    initHttpServer
}