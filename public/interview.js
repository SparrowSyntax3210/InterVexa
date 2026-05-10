/* ================= VARIABLES ================= */

let startBtn;
let stopBtn;
let questionList;

let mediaRecorder;
let audioChunks = [];

/* ================= INIT ================= */

window.addEventListener("DOMContentLoaded", async () => {
  startBtn = document.getElementById("startBtn");

  stopBtn = document.getElementById("stopBtn");

  questionList = document.querySelector(".question-list");

  console.log("Question List:", questionList);

  initButtons();

  await loadQuestions();

  await startInterview();
});

/* ================= BUTTON EVENTS ================= */

function initButtons() {
  // START RECORDING
  startBtn.addEventListener("click", async () => {
    try {
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

      console.log("Recording Started");
    } catch (error) {
      console.error("Mic Error:", error);
    }
  });

  // STOP RECORDING
  stopBtn.addEventListener("click", () => {
    if (mediaRecorder) {
      mediaRecorder.stop();

      console.log("Recording Stopped");
    }
  });
}

/* ================= AI VOICE ================= */

function askAIVoice(text) {
  if (!("speechSynthesis" in window)) return;

  const synth = window.speechSynthesis;

  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  utterance.rate = 0.9;

  synth.speak(utterance);
}

/* ================= ACTIVE QUESTION ================= */

function getActiveCard() {
  return document.querySelector(".question-card.active-question");
}

function getActiveQuestionBox() {
  return getActiveCard()?.querySelector("h4");
}

function getActiveAnswerBox() {
  return getActiveCard()?.querySelector("p");
}

/* ================= LOAD QUESTIONS ================= */

async function loadQuestions() {
  try {
    const response = await fetch("http://localhost:4000/interview/report");

    const report = await response.json();

    console.log(report);

    if (!report.questions || report.questions.length === 0) {
      console.log("No questions found");
      return;
    }

    questionList.innerHTML = "";

    report.questions.forEach((item, index) => {
      const card = document.createElement("div");

      card.className =
        index === 0 ? "question-card active-question" : "question-card";

      card.innerHTML = `
        <div class="question-number">
          ${String(index + 1).padStart(2, "0")}
        </div>

        <div class="question-content">
          <h4>${item.question}</h4>

          <p>Waiting for answer...</p>
        </div>

        <span class="question-time">
          LIVE
        </span>
      `;

      questionList.appendChild(card);
    });

    console.log(questionList.innerHTML);
  } catch (error) {
    console.error(error);
  }
}

/* ================= START INTERVIEW ================= */

async function startInterview() {
  try {
    const response = await fetch("http://localhost:4000/interview/start");

    const data = await response.json();

    console.log("START:", data);

    if (data.currentQuestion) {
      const questionBox = getActiveQuestionBox();

      if (questionBox) {
        questionBox.innerText = data.currentQuestion.question;

        askAIVoice(data.currentQuestion.question);
      }
    }
  } catch (error) {
    console.error("Start Error:", error);
  }
}

/* ================= WHISPER ================= */

async function sendToWhisper() {
  try {
    const answerBox = getActiveAnswerBox();

    if (!audioChunks.length) {
      answerBox.innerHTML = "No Audio ❌";
      return;
    }

    answerBox.innerHTML = "Analyzing Answer...";

    const audioBlob = new Blob(audioChunks, {
      type: "audio/webm",
    });

    const formData = new FormData();

    formData.append("audio", audioBlob, "audio.webm");

    const response = await fetch("http://localhost:5000/transcribe", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    console.log("TRANSCRIPT:", data);

    if (!data.text) {
      answerBox.innerHTML = "No transcript found ❌";
      return;
    }

    answerBox.innerText = data.text;

    await sendFeedback(data.text);
  } catch (error) {
    console.error("Whisper Error:", error);
  }

  audioChunks = [];
}

/* ================= SEND ANSWER ================= */

async function sendFeedback(transcript) {
  try {
    const response = await fetch("http://localhost:4000/interview/answer", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        text: transcript,
      }),
    });

    const data = await response.json();

    console.log("NEXT QUESTION:", data);

    const currentCard = getActiveCard();

    const nextCard = currentCard?.nextElementSibling;

    // REMOVE CURRENT ACTIVE
    currentCard?.classList.remove("active-question");

    // SET NEXT ACTIVE
    if (nextCard) {
      nextCard.classList.add("active-question");
    }

    // NEXT QUESTION
    if (data.nextQuestion && nextCard) {
      const nextQuestionBox = nextCard.querySelector("h4");

      nextQuestionBox.innerText = data.nextQuestion.question;

      askAIVoice(data.nextQuestion.question);
    } else {
      alert("Interview Completed 🎉");
    }
  } catch (error) {
    console.error("Answer Error:", error);
  }
}
