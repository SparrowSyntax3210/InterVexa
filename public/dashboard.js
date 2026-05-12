/* ================= LOAD REPORT ================= */

async function loadReport() {
  try {
    const response = await fetch("http://localhost:4000/view-report");

    if (!response.ok) {
      throw new Error("Failed to fetch report");
    }

    const report = await response.json();

    const answerDiv = document.querySelector(".answer");

    let html = "";

    let totalScore = 0;
    let bestScore = 0;

    report.answers.forEach((item, index) => {
      const feedback = item.feedback || {};

      const score = Number(feedback.score || 0);

      const communicationScore = Number(feedback.communicationScore || 0);

      const technicalScore = Number(feedback.technicalScore || 0);

      totalScore += score;

      if (score > bestScore) {
        bestScore = score;
      }

      html += `

      <div class="feedback-card">

        <h2 class="question-title">
          Question ${index + 1}
        </h2>

        <div class="report-section">

  <h3>Question:</h3>

  <p>
    ${item.question || "No Question"}
  </p>

</div>

<div class="report-section">

  <h3>Answer:</h3>

  <p>
    ${item.answer || "No Answer"}
  </p>

</div>

        <div class="score-box">

          <!-- OVERALL -->

          <div class="score-item">

            <h4>Overall Score</h4>

            <div class="score-percent">
              ${score}%
            </div>

            <div class="score-content">
              ${feedback.summary || "No summary available"}
            </div>

          </div>

          <!-- COMMUNICATION -->

          <div class="score-item">

            <h4>Communication</h4>

            <div class="score-percent">
              ${communicationScore}%
            </div>

            <div class="score-content">
              ${feedback.communication || "No communication feedback"}
            </div>

          </div>

          <!-- TECHNICAL -->

          <div class="score-item">

            <h4>Technical</h4>

            <div class="score-percent">
              ${technicalScore}%
            </div>

            <div class="score-content">
              ${feedback.technical || "No technical feedback"}
            </div>

          </div>

        </div>

      </div>

      `;
    });

    answerDiv.innerHTML = html;

    /* ================= STATS ================= */

    const totalInterviews = report.answers.length;

    const avgScore = totalInterviews
      ? Math.round(totalScore / totalInterviews)
      : 0;

    document.getElementById("totalInterviews").innerText = totalInterviews;

    document.getElementById("confidenceScore").innerText =
      (report.stats?.confidenceScore || 0) + "%";

    document.getElementById("bestScore").innerText = bestScore + "%";

    document.getElementById("overallScore").innerText = avgScore + "%";

    /* ================= UPDATE CIRCLE ================= */

    const degree = (avgScore / 100) * 360;

    document.getElementById("circle").style.background = `conic-gradient(
      #00f7ff 0deg,
      #00f7ff ${degree}deg,
      #0d0d0d ${degree}deg
    )`;
  } catch (error) {
    console.log("LOAD REPORT ERROR:", error);
  }
}

/* ================= DOWNLOAD REPORT ================= */

const downloadBtn = document.getElementById("downloadReportBtn");

downloadBtn.addEventListener("click", async () => {
  try {
    downloadBtn.disabled = true;

    downloadBtn.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      Generating...
    `;

    const response = await fetch("http://localhost:4000/download-report");

    if (!response.ok) {
      throw new Error("Failed to download report");
    }

    /* ================= GET PDF BLOB ================= */

    const blob = await response.blob();

    /* ================= CREATE TEMP URL ================= */

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = "InterVexa-Report.pdf";

    document.body.appendChild(a);

    a.click();

    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.log("DOWNLOAD ERROR:", error);

    alert("Failed to download report");
  } finally {
    downloadBtn.disabled = false;

    downloadBtn.innerHTML = `
      <i class="fa-solid fa-download"></i>
      Download Report
    `;
  }
});

/* ================= INIT ================= */

loadReport();
