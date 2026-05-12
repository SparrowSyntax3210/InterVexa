async function loadReport() {
  try {
    const response = await fetch("/view-report");

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
            ${report.questions[index]?.question || "No Question"}
          </p>

        </div>

        <div class="report-section">

          <h3>Answer:</h3>

            <p>${
              item.finalAnswer
                ? item.finalAnswer.split("\n")[0]
                : item.answer || "No Answer"
            }</p>

        </div>

        <div class="score-box">

          <!-- ================= OVERALL ================= -->

          <div class="score-item">

            <h4>Overall Score</h4>

            <div class="score-percent">
              ${score}%
            </div>

            <div class="score-content">
              ${feedback.summary || "No summary available"}
            </div>

          </div>

          <!-- ================= COMMUNICATION ================= -->

          <div class="score-item">

            <h4>Communication</h4>

            <div class="score-percent">
              ${communicationScore}%
            </div>

            <div class="score-content">
              ${feedback.communication || "No communication feedback"}
            </div>

          </div>

          <!-- ================= TECHNICAL ================= -->

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

    document.getElementById("avgScore").innerText = avgScore + "%";

    document.getElementById("bestScore").innerText = bestScore + "%";

    document.getElementById("overallScore").innerText = avgScore + "%";

    /* ================= CIRCLE ================= */

    const degree = (avgScore / 100) * 360;

    document.getElementById("circle").style.background = `conic-gradient(
      #00f7ff 0deg,
      #00f7ff ${degree}deg,
      #0d0d0d ${degree}deg
    )`;
  } catch (error) {
    console.log(error);
  }
}

loadReport();
