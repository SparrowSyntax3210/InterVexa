const role = document.getElementById("role");
const experience = document.getElementById("experience");
const mode = document.getElementById("mode");
const stopBtn = document.getElementById("stopBtn");
const uploadBox = document.getElementById("uploadBox");
const resumeUpload = document.getElementById("resumeUpload");
const resumeText = document.getElementById("resumeText");

const analyzeBtn = document.getElementById("analyzeBtn");
const startBtn = document.getElementById("startBtn");
const startInterview = document.getElementById("startInterview");

const analysisResult = document.getElementById("analysisResult");

let resumeFile = null;
let projects = [];
let skills = [];
let resumeContent = "";

uploadBox.addEventListener("click", () => {
  resumeUpload.click();
});

resumeUpload.addEventListener("change", (e) => {
  resumeFile = e.target.files[0];

  if (resumeFile) {
    resumeText.innerText = resumeFile.name;
  }
});

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

let mediaRecorder;
let audioChunks = [];

startBtn.addEventListener("click", async () => {
  console.log("Start clicked");

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };

  mediaRecorder.onstop = sendToWhisper;

  mediaRecorder.start();

  console.log("Recording started...");
});

stopBtn.addEventListener("click", () => {
  console.log("Stop clicked");
  mediaRecorder.stop();
});

async function sendToWhisper() {
  console.log("Sending to whisper...");

  const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

  const formData = new FormData();
  formData.append("audio", audioBlob);

  try {
    const response = await fetch("http://localhost:5000/transcribe", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    console.log("Speech Text:", data.text);
  } catch (error) {
    console.error("Error:", error);
  }

  audioChunks = [];
}

async function analyzeResume(file) {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("http://localhost:4000/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    return data;
  } catch (error) {
    console.error("Analyze error:", error);
    return {};
  }
}

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

startInterview.addEventListener("click", async () => {
  startBtn.innerText = "Starting...";

  const response = await fetch("http://localhost:4000/start-interview", {
    method: "POST",
  });

  const data = await response.json();

  questions = data.questions;

  renderQuestions();

  startBtn.innerText = "Start Interview";
});
