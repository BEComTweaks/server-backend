async function zipFolder(directory) {
  const file_system = require("fs");
  const archiver = require("archiver");

  return new Promise((resolve, reject) => {
    const output = file_system.createWriteStream(`${directory}.zip`);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Sets the compression level.
    });

    output.on("close", function () {
      console.log(archive.pointer() + " total bytes");
      console.log(
        "archiver has been finalized and the output file descriptor has closed.",
      );
      resolve(); // Resolve the promise when the archive is finalized and the output stream is closed.
    });

    output.on("end", function () {
      console.log("Data has been drained");
    });

    archive.on("warning", function (err) {
      if (err.code === "ENOENT") {
        // log warning
        console.warn(err);
      } else {
        // throw error
        reject(err); // Reject the promise on a critical error.
      }
    });

    archive.on("error", function (err) {
      reject(err); // Reject the promise on any error.
    });

    // pipe archive data to the file
    archive.pipe(output);

    // append a directory from stream with a custom name
    // The second argument `false` makes sure that the contents of the `directory` are
    // put at the root of the archive, without including the top-level directory itself.
    archive.directory(directory, false);

    // finalize the archive (ie close the stream and finish archiving)
    archive.finalize();
  });
}

module.exports = zipFolder;