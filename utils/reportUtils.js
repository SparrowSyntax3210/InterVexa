const fs = require("fs");
const path = require("path");

const reportDir = path.join(process.cwd(), "reports");

// GET LATEST REPORT PATH
function getLatestReportPath() {
  const files = fs.readdirSync(reportDir);

  if (!files.length) {
    return null;
  }

  const latestFile = files
    .map((file) => ({
      name: file,
      time: fs.statSync(path.join(reportDir, file)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time)[0];

  return path.join(reportDir, latestFile.name);
}

// READ REPORT
function readReport() {
  const reportPath = getLatestReportPath();

  if (!reportPath) {
    return null;
  }

  return JSON.parse(fs.readFileSync(reportPath, "utf-8"));
}

// SAVE REPORT
function saveReport(report) {
  const reportPath = getLatestReportPath();

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
}

module.exports = {
  reportDir,
  getLatestReportPath,
  readReport,
  saveReport,
};
