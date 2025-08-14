const express = require("express");
const cors = require("cors");
const http = require("http");
const acceptableHttpPorts = [80, 8080, 8000];
function initHttpServer() {
    let httpPortIndex = 0;
    const httpApp = express();

    httpApp.use(cors());
    httpApp.use(express.text({ type: 'application/json' }));
    const httpServer = http.createServer(httpApp);
    startHttpServer(acceptableHttpPorts[0]);

    function startHttpServer(port) {
        console.log(`Starting HTTP server on port ${port}...`);
        httpServer.listen(port);
    }

    httpServer.on('listening', () => {
        const port = httpServer.address().port;
        console.log(`Http server is running at http://localhost:${port}`);
    });

    httpServer.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.log(`Port ${e.port} is already in use.`);
            changePort();
        } else if (e.code === 'EACCES') {
            console.log(`Permission denied to use HTTP port ${e.port}`)
            changePort();
        } else {
            console.log(`Error with HTTP server:`, e.message);
        }
    });

    function changePort() {
        httpPortIndex++;
        if (httpPortIndex < acceptableHttpPorts.length) {
            const nextPort = acceptableHttpPorts[httpPortIndex];
            console.log(`Trying next port: ${nextPort}`);
            startHttpServer(nextPort);
        } else {
            console.error("No more acceptable HTTP ports available.");
        }
    }
    return httpApp
}
module.exports = {
    initHttpServer
}