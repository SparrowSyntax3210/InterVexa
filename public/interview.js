/* ================= VARIABLES ================= */

let startBtn;
let stopBtn;
let videoBtn;
let VoiceBtn;

let questionList;

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

  initButtons();

  await loadQuestions();

  await startInterview();
});

/* ================= BUTTONS ================= */

function initButtons() {
  /* ===== START RECORDING ===== */

  /* ================= MIC TOGGLE ================= */

  let isRecording = false;

  VoiceBtn.addEventListener("click", async () => {
    /* ===== STOP RECORDING ===== */

    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();

      VoiceBtn.classList.remove("recording");

      VoiceBtn.innerHTML = `<i class="fa-solid fa-microphone"></i>`;

      isRecording = false;

      console.log("Recording Stopped");

      return;
    }

    /* ===== START RECORDING ===== */

    try {
      console.log("Recording Started");

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

      VoiceBtn.classList.add("recording");

      VoiceBtn.innerHTML = `<i class="fa-solid fa-stop"></i>`;

      isRecording = true;
    } catch (error) {
      console.error("Mic Error:", error);
    }
  });

  /* ================= VIDEO TOGGLE ================= */

  let isVideoOn = false;

  /* ===== DEFAULT VIDEO ON ===== */

  const videoStream = document.getElementById("videoStream");

  videoStream.src = "http://localhost:8000/video";

  /* ================= TOGGLE ================= */

  videoBtn.addEventListener("click", () => {
    /* ===== TURN OFF ===== */

    if (isVideoOn) {
      videoStream.src = "";

      videoBtn.classList.add("off");

      videoBtn.innerHTML = `<i class="fa-solid fa-video-slash"></i>`;

      isVideoOn = false;

      console.log("Video Stopped");
    } else {
      /* ===== TURN ON ===== */
      videoStream.src = "http://localhost:8000/video";

      videoBtn.classList.remove("off");

      videoBtn.innerHTML = `<i class="fa-solid fa-video"></i>`;

      isVideoOn = true;

      console.log("Video Started");
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

/* ================= ACTIVE CARD ================= */

function getActiveCard() {
  return document.querySelector(".question-card.active-question");
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

            <h4>
              ${item.question}
            </h4>

            <div class="answer-wrapper">

              <textarea
                class="answer-box"
                placeholder="Your answer..."
              ></textarea>

              <button class="submitAnswer">
                Submit Answer
              </button>

            </div>

          </div>

          <span class="question-time">
            LIVE
          </span>

        `;

      questionList.appendChild(card);

      /* ================= SUBMIT ================= */

      const submitBtn = card.querySelector(".submitAnswer");

      submitBtn.addEventListener("click", async () => {
        console.log("Submit Clicked");

        const answerBox = card.querySelector(".answer-box");

        const answer = answerBox.value.trim();

        if (!answer) {
          answerBox.focus();

          return;
        }

        try {
          /* ===== SAVE ANSWER ===== */

          await fetch("http://localhost:4000/interview/answer", {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              question: item.question,

              answer,
            }),
          });

          console.log("Answer Saved");

          /* ===== NEXT CARD ===== */

          const nextCard = card.nextElementSibling;

          /* ===== REMOVE CURRENT ===== */

          card.remove();

          /* ===== ACTIVATE NEXT ===== */

          if (nextCard) {
            nextCard.classList.add("active-question");

            nextCard.scrollIntoView({
              behavior: "smooth",

              block: "center",
            });

            const nextAnswerBox = nextCard.querySelector(".answer-box");

            if (nextAnswerBox) {
              nextAnswerBox.focus();
            }

            const nextQuestion = nextCard.querySelector("h4").innerText;

            askAIVoice(nextQuestion);
          } else {
            alert("Interview Completed");
          }
        } catch (error) {
          console.log("Submit Error:", error);
        }
      });
    });

    console.log("Questions Loaded");
  } catch (error) {
    console.error("Load Question Error:", error);
  }
}

/* ================= START INTERVIEW ================= */

async function startInterview() {
  try {
    const activeCard = getActiveCard();

    if (!activeCard) return;

    const question = activeCard.querySelector("h4").innerText;

    askAIVoice(question);
  } catch (error) {
    console.error("Start Error:", error);
  }
}

/* ================= WHISPER ================= */

async function sendToWhisper() {
  try {
    const answerBox = getActiveAnswerBox();

    if (!audioChunks.length) {
      alert("No audio found");

      return;
    }

    if (answerBox) {
      answerBox.value = "Analyzing...";
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

    if (answerBox) {
      answerBox.value = data.text;
    }
  } catch (error) {
    console.error("Whisper Error:", error);
  }

  audioChunks = [];
}
