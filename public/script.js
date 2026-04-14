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

resumeUpload.addEventListener("change", (e) => {
  resumeFile = e.target.files[0];

  if (resumeFile) {
    resumeText.innerText = resumeFile.name;
  }
});

/* ================= Analyze Resume ================= */

analyzeBtn.addEventListener("click", async () => {
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

  startBtn.innerText = "Recording";
});

stopBtn.addEventListener("click", () => {
  if (mediaRecorder) {
    mediaRecorder.stop();
  }
  startBtn.innerText = "Recording Completed";
});

document.getElementById("video").addEventListener("click", () => {
  console.log("Button clicked");
  startTracking();
});

async function startTracking() {
  console.log("Sending request...");

  try {
    const response = await fetch("http://localhost:6000/video", {
      method: "POST",
    });

    const data = await response.json();

    console.log("Confidence Score:", data.confidence_score);
  } catch (error) {
    console.error("Error:", error);
  }
}

/* ================= Whisper ================= */

async function sendToWhisper() {
  const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

  const formData = new FormData();
  formData.append("audio", audioBlob);

  try {
    const response = await fetch("http://localhost:5000/transcribe", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    const transcript = data.text;

    console.log("Transcript:", transcript);

    await sendFeedback(transcript);
  } catch (error) {
    console.error("Whisper Error:", error);
  }

  audioChunks = [];
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
    console.log("Fallback triggered");

    const fallback = "Hello, I am ready to interview you. Let's begin.";

    document.getElementById("question").innerText = fallback;

    askAIVoice(fallback);
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

  try {
    const response = await fetch("http://localhost:4000/upload", {
      method: "POST",
      body: formData,
    });

    return await response.json();
  } catch (error) {
    console.error(error);
    return {};
  }
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
