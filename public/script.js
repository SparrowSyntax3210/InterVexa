alert("script is ruigs");

console.log("Script Loaded");

const BASE_URL = "http://localhost:4000";

let interviewId;
let questions = [];
let currentQuestion = 0;

// Upload Resume
async function uploadResume() {
  const file = document.getElementById("resume").files[0];

  const formData = new FormData();
  formData.append("resume", file);

  const res = await fetch(`${BASE_URL}/resume`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  window.resumeData = data;

  console.log(data);
}

// Generate Questions
async function generateQuestions() {
  const role = document.getElementById("role").value;
  const experience = document.getElementById("experience").value;
  const mode = document.getElementById("mode").value;

  const res = await fetch(`${BASE_URL}/generate-questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role,
      experience,
      mode,
      resumeText: window.resumeData?.resumeText,
      projects: window.resumeData?.projects,
      skills: window.resumeData?.skills,
    }),
  });

  const data = await res.json();

  interviewId = data.interviewId;
  questions = data.questions;

  showQuestion();
}

// Show Question
function showQuestion() {
  document.getElementById("question").innerText =
    questions[currentQuestion].question;
}

// Submit Answer
async function submitAnswer() {
  const answer = document.getElementById("answer").value;

  const res = await fetch(`${BASE_URL}/submit-answer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      interviewId,
      questionIndex: currentQuestion,
      answer,
      timeTaken: 30,
    }),
  });

  const data = await res.json();

  document.getElementById("feedback").innerText = data.feedback;

  currentQuestion++;

  if (currentQuestion < questions.length) {
    showQuestion();
  }
}

// Finish Interview
async function finishInterview() {
  const res = await fetch(`${BASE_URL}/finish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      interviewId,
    }),
  });

  const data = await res.json();

  document.getElementById("report").innerText =
    "Final Score: " + data.finalScore;
}

// Event Listeners
document
  .getElementById("startInterview")
  .addEventListener("click", generateQuestions);

document.getElementById("submitAnswer").addEventListener("click", submitAnswer);

document
  .getElementById("finishInterview")
  .addEventListener("click", finishInterview);

document.getElementById("ques").addEventListener("click", generateQuestions);
