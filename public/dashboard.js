async function loadReport() {
  try {
    const response = await fetch("/view-report");

    const report = await response.json();

    const answerDiv = document.querySelector(".answer");

    let html = "";

    report.answers.forEach((item, index) => {
      const feedback = item.feedback || {};

      html += `
        <div class="feedback-card">

          <h3>Question ${index + 1}</h3>

          <p>
            <strong>Question:</strong>
            ${report.questions[index]?.question || "No Question"}
          </p>

          <p>
            <strong>Answer:</strong>
            ${item.answer || "No answer"}
          </p>

          <p>
            <strong>Score:</strong>
            ${feedback.score || "N/A"}
          </p>

          <p>
            <strong>Communication:</strong>
            ${feedback.communication || "N/A"}
          </p>

          <p>
            <strong>Technical:</strong>
            ${feedback.technical || "N/A"}
          </p>

        </div>
      `;
    });

    answerDiv.innerHTML = html;
  } catch (error) {
    console.log(error);
  }
}

loadReport();
