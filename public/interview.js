/* ================= VARIABLES ================= */

let startBtn;
let stopBtn;
let videoBtn;
let questionList;
let nextQuestion;
let VoiceBtn;

let mediaRecorder;
let audioChunks = [];

/* ================= DOM READY ================= */

window.addEventListener("DOMContentLoaded", async () => {
  console.log("JS Loaded");

  startBtn = document.getElementById("startBtn");

  stopBtn = document.getElementById("stopBtn");

  videoBtn = document.getElementById("videoBtn");

  VoiceBtn = document.getElementById("micBtn");

  questionList = document.querySelector(".question-list");

  nextQuestion = document.getElementById("nextQuestion");

  initButtons();

  await loadQuestions();

  await startInterview();
});

/* ================= BUTTON EVENTS ================= */

function initButtons() {
  /* ===== START RECORDING ===== */

  VoiceBtn.addEventListener("click", async () => {
    console.log("Recording Started");

    try {
      const answerBox = getActiveAnswerBox();

      if (answerBox) {
        answerBox.value = "";
      }

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
    } catch (error) {
      console.error("Mic Error:", error);
    }
  });

  /* ===== STOP RECORDING ===== */

  stopBtn.addEventListener("click", () => {
    console.log("Recording Stopped");

    if (mediaRecorder) {
      mediaRecorder.stop();
    }
  });

  /* ===== VIDEO ===== */

  videoBtn.addEventListener("click", () => {
    const videoStream = document.getElementById("videoStream");

    videoStream.src = "http://localhost:8000/video";
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
  return getActiveCard()?.querySelector(".answer-box");
}

/* ================= LOAD QUESTIONS ================= */

async function loadQuestions() {
  try {
    const response = await fetch("http://localhost:4000/interview/report");

    const report = await response.json();

    console.log("REPORT:", report);

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

          <textarea
            class="answer-box"
            placeholder="Your answer..."
          ></textarea>
        </div>

        <span class="question-time">
          LIVE
        </span>
      `;

      questionList.appendChild(card);
    });

    console.log("Questions Loaded");
  } catch (error) {
    console.error("Load Question Error:", error);
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

/* ================= SEND TO WHISPER ================= */

async function sendToWhisper() {
  try {
    const answerBox = getActiveAnswerBox();

    if (!audioChunks.length) {
      alert("No audio found");
      return;
    }

    if (answerBox) {
      answerBox.value = "Transcribing...";
    }

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
      if (answerBox) {
        answerBox.value = "No transcript found";
      }

      return;
    }

    /* ===== SHOW TRANSCRIPT ===== */

    if (answerBox) {
      answerBox.value = data.text;
    }

    /* ===== USER CAN EDIT NOW ===== */

    const shouldSend = confirm("Submit this answer?");

    if (shouldSend) {
      await sendFeedback(answerBox.value);
    }
  } catch (error) {
    console.error("Whisper Error:", error);
  }

  audioChunks = [];
} /* ================= SEND ANSWER ================= */

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

    console.log("ANSWER RESPONSE:", data);

    const currentCard = getActiveCard();

    const nextCard = currentCard?.nextElementSibling;

    currentCard?.classList.remove("active-question");

    if (nextCard) {
      nextCard.classList.add("active-question");
    }

    /* ===== NEXT QUESTION ===== */

    if (data.nextQuestion && nextCard) {
      const nextQuestionBox = nextCard.querySelector("h4");

      nextQuestionBox.innerText = data.nextQuestion.question;

      const nextAnswerBox = nextCard.querySelector(".answer-box");

      if (nextAnswerBox) {
        nextAnswerBox.value = "";
      }

      askAIVoice(data.nextQuestion.question);
    } else {
      alert("Interview Completed");
    }
  } catch (error) {
    console.error("Answer Error:", error);
  }
}

/* ================= SUBMIT ANSWER ================= */

const submitAnswer = document.getElementById("submitAnswer");

if (submitAnswer) {
  submitAnswer.addEventListener("click", async () => {
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

      console.log("FEEDBACK:", data);

      if (data.feedback) {
        document.getElementById("feedback").innerText = JSON.stringify(
          data.feedback,
          null,
          2,
        );
      }
    } catch (error) {
      console.error(error);
    }
  });
}
