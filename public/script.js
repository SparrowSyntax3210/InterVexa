const role = document.getElementById("role");
const experience = document.getElementById("experience");
const mode = document.getElementById("mode");
const stopBtn = document.getElementById("stopBtn");
const uploadBox = document.getElementById("uploadBox");
const resumeUpload = document.getElementById("resumeUpload");
const resumeText = document.getElementById("resumeText");
const analyzeBtn = document.getElementById("analyzeBtn");
const startBtn = document.getElementById("startBtn");
const startInterviewBtn = document.getElementById("startInterview");
const analysisResult = document.getElementById("analysisResult");

let resumeFile = null;
let projects = [];
let skills = [];
let resumeContent = "";

/* ================= Upload Resume ================= */

uploadBox.addEventListener("click", () => {
  resumeUpload.click();
});

resumeUpload.addEventListener("change", (e) => {
  resumeFile = e.target.files[0];

  if (resumeFile) {
    resumeText.innerText = resumeFile.name;
  }
});

/* ================= Analyze Resume ================= */

analyzeBtn.addEventListener("click", async (e) => {
  e.stopPropagation();

  if (!resumeFile) return;

  analyzeBtn.innerText = "Analyzing...";

  const result = await analyzeResume(resumeFile);

  role.value = result.role || "";
  experience.value = result.experience || "";

  projects = result.projects || [];
  skills = result.skills || [];

  resumeContent = result.resumeText || "";

  renderAnalysis();

  analyzeBtn.innerText = "Analyze Resume";
});

/* ================= Audio Recording ================= */

let mediaRecorder;
let audioChunks = [];

startBtn.addEventListener("click", async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  mediaRecorder = new MediaRecorder(stream);

  audioChunks = [];

  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };

  mediaRecorder.onstop = sendToWhisper;

  mediaRecorder.start();

  console.log("Recording started...");
});

stopBtn.addEventListener("click", () => {
  if (mediaRecorder) {
    mediaRecorder.stop();
    console.log("Recording stopped...");
  }
});

/* ================= Whisper ================= */

async function sendToWhisper() {
  const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

  const formData = new FormData();
  formData.append("audio", audioBlob);

  try {
    console.log("Sending audio to whisper...");

    const response = await fetch("http://localhost:5000/transcribe", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    console.log("Transcript:", data.text);

    const transcript = data.text;

    await sendFeedback(transcript);
  } catch (error) {
    console.error("Whisper Error:", error);
  }

  audioChunks = [];
}

/* ================= Feedback ================= */

async function sendFeedback(transcript) {
  try {
    console.log("Sending to feedback API...");

    const feedbackRes = await fetch(
      "http://localhost:4000/interview-feedback",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: transcript,
        }),
      },
    );

    const feedbackData = await feedbackRes.json();

    console.log("Feedback Data:", feedbackData);

    if (!feedbackData.feedback) {
      document.getElementById("feedback").innerText = "No feedback received";
      return;
    }

    document.getElementById("feedback").innerHTML = `
<p><b>Communication:</b> ${feedbackData.feedback.communication || "N/A"}</p>
<p><b>Technical:</b> ${feedbackData.feedback.technical || "N/A"}</p>
<p><b>Strengths:</b> ${(feedbackData.feedback.strengths || []).join(", ")}</p>
<p><b>Improvements:</b> ${(feedbackData.feedback.improvements || []).join(", ")}</p>
<p><b>Overall Score:</b> ${feedbackData.feedback.overallScore || "N/A"}</p>
`;

    // Next Question

    if (feedbackData.nextQuestion) {
      document.getElementById("question").innerText =
        feedbackData.nextQuestion.question;
    } else {
      document.getElementById("question").innerText = "Interview Completed 🎉";
    }
  } catch (error) {
    console.error("Feedback Error:", error);
  }
}

/* ================= Start Interview ================= */

startInterviewBtn.addEventListener("click", async () => {
  try {
    const response = await fetch("http://localhost:4000/start-interview", {
      method: "POST",
    });

    const data = await response.json();

    console.log("Interview Started:", data);

    if (!data.question) {
      document.getElementById("question").innerText = "No question received";
      return;
    }

    document.getElementById("question").innerText = data.question.question;

    document.getElementById("feedback").innerHTML = "";
  } catch (error) {
    console.error("Start Interview Error:", error);
  }
});

/* ================= Analyze Resume API ================= */

async function analyzeResume(file) {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("http://localhost:4000/upload", {
      method: "POST",
      body: formData,
    });

    return await response.json();
  } catch (error) {
    console.error("Analyze error:", error);
    return {};
  }
}

// Submit Answer
document.getElementById("submitAnswer").addEventListener("click", async () => {
  try {
    const response = await fetch("http://localhost:4000/interview-feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        send: true,
      }),
    });

    const data = await response.json();

    // Show feedback
    if (data.feedback) {
      document.getElementById("feedback").innerText = JSON.stringify(
        data.feedback,
        null,
        2,
      );
    }
  } catch (error) {
    console.error("Submit Error:", error);
  }
});

// Next Question
const nextQuestion = document.getElementById("nextquestion");

nextQuestion.addEventListener("click", async () => {
  try {
    const response = await fetch("http://localhost:4000/nextquestion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();

    console.log(data);

    // Show next question
    if (data.question) {
      document.getElementById("question").innerText = data.question.question;
    }

    if (data.message) {
      document.getElementById("question").innerText = data.message;
    }
  } catch (error) {
    console.error("Next Question Error:", error);
  }
});
/* ================= Render Analysis ================= */

function renderAnalysis() {
  analysisResult.innerHTML = "";

  if (projects.length > 0) {
    analysisResult.innerHTML += `
<h3>Projects</h3>
<ul>
${projects.map((p) => `<li>${p}</li>`).join("")}
</ul>
`;
  }

  if (skills.length > 0) {
    analysisResult.innerHTML += `
<h3>Skills</h3>
<div>
${skills.map((s) => `<span class="skill">${s}</span>`).join("")}
</div>
`;
  }
}
