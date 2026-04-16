/* ================= AI Voice Engine ================= */

function askAIVoice(text) {
  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  const voices = synth.getVoices();
  utterance.voice =
    voices.find((v) => v.name.includes("Zira") || v.name.includes("Female")) ||
    voices[0];

  utterance.rate = 0.9;
  synth.speak(utterance);
}

// Load voices properly
if ("speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    console.log("Voices Loaded");
  };
}

/* ================= DOM ================= */

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
const nextQuestion = document.getElementById("nextquestion");

let resumeFile = null;
let projects = [];
let skills = [];
let resumeContent = "";

/* ================= Upload Resume ================= */

uploadBox.addEventListener("click", () => {
  resumeUpload.click();
});
/* FIX HERE → change instead of click */
resumeUpload.addEventListener("change", (e) => {
  resumeFile = e.target.files[0];

  if (resumeFile) {
    resumeText.innerText = resumeFile.name;
  }
});

/* ================= Interview Form ================= */

document
  .getElementById("interviewForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const role = document.getElementById("role").value;
    const experience = document.getElementById("experience").value;
    const mode = document.getElementById("mode").value;

    await fetch("http://localhost:4000/form", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role,
        experience,
        mode,
      }),
    });
  });

uploadBox.addEventListener("click", (e) => {
  if (e.target.id !== "analyzeBtn") {
    resumeUpload.click();
  }
});

/* ================= Analyze Resume ================= */

analyzeBtn.addEventListener("click", async (e) => {
  e.stopPropagation(); // ✅ Prevent upload popup

  if (!resumeFile) {
    alert("Please upload resume first");
    return;
  }

  analyzeBtn.innerText = "Analyzing...";

  const result = await analyzeResume(resumeFile);

  analyzeBtn.innerText = "Analyzed ✅";
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

  startBtn.innerText = "Recording";
});

stopBtn.addEventListener("click", () => {
  if (mediaRecorder) {
    mediaRecorder.stop();
  }

  stopBtn.innerText = "Recorded ✅";

  setTimeout(() => {
    stopBtn.innerText = "Analyzing... 🧠";
  }, 300);
});

// Start Video
document.getElementById("video").addEventListener("click", () => {
  document.getElementById("videoStream").src = "http://localhost:8000/video";
});

// Stop Video
document.getElementById("stopVideo").addEventListener("click", async () => {
  await fetch("http://localhost:8000/stop-video", {
    method: "POST",
  });

  document.getElementById("videoStream").src = "";

  getScore();
});

// Get Confidence Score
async function getScore() {
  const res = await fetch("http://localhost:8000/confidence");

  const data = await res.json();

  console.log("Confidence Score:", data.confidence_score);
}

/* ================= Whisper ================= */
async function sendToWhisper() {
  const answerBox = document.getElementById("Answer");

  const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.webm");

  try {
    // show loading state
    answerBox.innerHTML = "Processing audio... ⏳";

    const response = await fetch("http://localhost:5000/transcribe", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    const transcript = data.text;

    console.log("Transcript:", transcript);

    // ❗ show answer in UI box
    answerBox.innerHTML = transcript;

    // optional typing effect (if you already have it)
    // typeAnswer(answerBox, transcript);

    // send for feedback
    await sendFeedback(transcript);

    stopBtn.innerText = "Analyzed ✅";
  } catch (error) {
    console.error("Whisper Error:", error);
    answerBox.innerHTML = "Error processing audio ❌";
  }

  audioChunks = [];
}

function showTypingState(element, text) {
  let dots = 0;

  element.innerHTML = text;

  const interval = setInterval(() => {
    dots = (dots + 1) % 4;
    element.innerHTML = text + ".".repeat(dots);
  }, 400);

  // stop after 3 seconds (or when replaced)
  setTimeout(() => clearInterval(interval), 3000);
}

function typeAnswer(element, text) {
  element.innerHTML = "";

  const words = text.split(" ");
  let index = 0;

  const interval = setInterval(() => {
    element.innerHTML += words[index] + " ";
    index++;

    if (index >= words.length) {
      clearInterval(interval);
    }
  }, 80); // speed of typing
}
/* ================= Feedback ================= */

async function sendFeedback(transcript) {
  try {
    const response = await fetch("http://localhost:4000/interview-feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: transcript,
      }),
    });

    const data = await response.json();

    if (!data.feedback) {
      document.getElementById("feedback").innerText = "No feedback received";
      return;
    }

    document.getElementById("feedback").innerHTML = `
<p><b>Communication:</b> ${data.feedback.communication || "N/A"}</p>
<p><b>Technical:</b> ${data.feedback.technical || "N/A"}</p>
<p><b>Strengths:</b> ${(data.feedback.strengths || []).join(", ")}</p>
<p><b>Improvements:</b> ${(data.feedback.improvements || []).join(", ")}</p>
<p><b>Overall Score:</b> ${data.feedback.overallScore || "N/A"}</p>
`;

    if (data.nextQuestion) {
      document.getElementById("question").innerText =
        data.nextQuestion.question;

      askAIVoice(data.nextQuestion.question);
    } else {
      document.getElementById("question").innerText = "Interview Completed 🎉";

      askAIVoice("Interview completed. Great job!");
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

    document.getElementById("question").innerText = data.question.question;

    askAIVoice(data.question.question);
  } catch (error) {
    console.log("No Question");
  }
});

/* ================= Submit Answer ================= */

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

    if (data.feedback) {
      document.getElementById("feedback").innerText = JSON.stringify(
        data.feedback,
        null,
        2,
      );
    }

    if (data.nextQuestion) {
      document.getElementById("question").innerText =
        data.nextQuestion.question;

      askAIVoice(data.nextQuestion.question);
    }
  } catch (error) {
    console.error(error);
  }
});

/* ================= Next Question ================= */

nextQuestion.addEventListener("click", async () => {
  try {
    const response = await fetch("http://localhost:4000/nextquestion", {
      method: "POST",
    });

    const data = await response.json();

    if (data.question) {
      document.getElementById("question").innerText = data.question.question;

      askAIVoice(data.question.question);
    }

    if (data.message) {
      document.getElementById("question").innerText = data.message;

      askAIVoice(data.message);
    }
  } catch (error) {
    console.error("Next Question Error:", error);
  }
});

/* ================= Analyze Resume ================= */

async function analyzeResume(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("http://localhost:4000/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  console.log(data);

  /* Show Skills on UI */
  const analysisResult = document.getElementById("analysisResult");

  analysisResult.innerHTML = `
    <h3>Resume Analysis</h3>
    <p><strong>Skills Found:</strong></p>
    <div class="skills">
      ${data.skills.map((skill) => `<span class="skill">${skill}</span>`).join("")}
    </div>
  `;

  return data;
}

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
