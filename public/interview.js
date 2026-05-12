/* ================= VARIABLES ================= */

let startBtn;
let stopBtn;
let videoBtn;
let VoiceBtn;
let dashboardBtn;

let questionList;

let mediaRecorder;
let audioChunks = [];

let isRecording = false;
let isVideoOn = true;

const overlay = document.getElementById("fullscreenOverlay");

overlay.addEventListener("click", async () => {
  try {
    await document.documentElement.requestFullscreen();

    overlay.style.display = "none";

    console.log("Overlay Removed");

    /* START INTERVIEW HERE */

    await startInterview();
  } catch (error) {
    console.log("Fullscreen Error:", error);
  }
});
/* ================= DOM READY ================= */

window.addEventListener("DOMContentLoaded", async () => {
  console.log("JS Loaded");

  startBtn = document.getElementById("startBtn");
  stopBtn = document.getElementById("stopBtn");
  videoBtn = document.getElementById("videoBtn");
  VoiceBtn = document.getElementById("micBtn");
  dashboardBtn = document.getElementById("dashboardBtn");

  questionList = document.querySelector(".question-list");

  initButtons();

  await loadQuestions();
});

/* ================= BUTTONS ================= */

function initButtons() {
  /* ================= MIC TOGGLE ================= */

  VoiceBtn.addEventListener("click", async () => {
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();

      VoiceBtn.classList.remove("recording");

      VoiceBtn.innerHTML = `<i class="fa-solid fa-microphone"></i>`;

      isRecording = false;

      console.log("Recording Stopped");

      return;
    }

    try {
      console.log("Recording Started");

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

  const videoStream = document.getElementById("videoStream");

  videoStream.src = "http://localhost:8000/video";

  videoBtn.addEventListener("click", () => {
    if (isVideoOn) {
      videoStream.src = "";

      videoBtn.classList.add("off");

      videoBtn.innerHTML = `<i class="fa-solid fa-video-slash"></i>`;

      isVideoOn = false;

      console.log("Video Stopped");
    } else {
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

      if (index === 0) {
        card.className = "question-card active-question";
      } else if (index === 1) {
        card.className = "question-card next-question";
      } else {
        card.className = "question-card hidden-question";
      }

      card.innerHTML = `
        <div class="question-number">
          ${String(index + 1).padStart(2, "0")}
        </div>

        <div class="question-content">
          <h4>${item.question}</h4>

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

        <span class="question-time">LIVE</span>
      `;

      questionList.appendChild(card);

      const submitBtn = card.querySelector(".submitAnswer");

      submitBtn.addEventListener("click", async () => {
        console.log("Submit Clicked");

        const answerBox = card.querySelector(".answer-box");
        const typedText = answerBox.value.trim();
        const transcript = answerBox.dataset.transcript || "";

        const finalAnswer = `${typedText}\n${transcript}`.trim();

        if (!finalAnswer) {
          answerBox.focus();
          return;
        }

        try {
          /* SAVE ANSWER */
          await fetch("http://localhost:4000/save-answer", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              questionIndex: index,
              typedText,
              transcript,
            }),
          });

          console.log("Answer Saved");

          card.style.display = "none";

          const nextCard = card.nextElementSibling;

          /* NEXT QUESTION */
          if (nextCard) {
            card.classList.remove("active-question");

            nextCard.classList.remove("hidden-question", "next-question");
            nextCard.classList.add("active-question");

            const secondNext = nextCard.nextElementSibling;

            if (secondNext) {
              secondNext.classList.remove("hidden-question");
              secondNext.classList.add("next-question");
            }

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
            /* INTERVIEW FINISHED */
            alert("Interview Completed");

            const loadingScreen = document.getElementById("loadingScreen");

            if (loadingScreen) {
              loadingScreen.classList.add("show");
            }

            try {
              /* STOP VIDEO */
              const videoStream = document.getElementById("videoStream");

              if (videoStream) {
                videoStream.src = "";
              }

              /* STOP MIC */
              if (
                typeof mediaRecorder !== "undefined" &&
                mediaRecorder &&
                mediaRecorder.state !== "inactive"
              ) {
                mediaRecorder.stop();
                console.log("Mic stopped");
              }

              if (typeof audioChunks !== "undefined") {
                audioChunks = [];
              }

              /* STOP SPEECH */
              window.speechSynthesis.cancel();

              /* STOP OPENCV */
              await fetch("http://localhost:8000/stop", {
                method: "POST",
              });

              /* STOP WHISPER */
              await fetch("http://localhost:5000/stop", {
                method: "POST",
              });

              console.log("Python services stopped");

              /* WAIT FOR PYTHON CLEANUP */
              await new Promise((resolve) => setTimeout(resolve, 4000));

              console.log("Generating report...");

              /* GENERATE REPORT */
              const controller = new AbortController();

              const timeout = setTimeout(() => {
                controller.abort();
              }, 60000);

              const reportResponse = await fetch(
                "http://localhost:4000/interview-feedback",
                {
                  method: "POST",
                  signal: controller.signal,
                },
              );

              clearTimeout(timeout);

              const data = await reportResponse.json();

              console.log("REPORT GENERATED:", data);

              if (!data.success) {
                throw new Error("Report generation failed");
              }

              setTimeout(async () => {
                if (document.fullscreenElement) {
                  await document.exitFullscreen();
                }

                window.location.href = "/dashboard.html";
              }, 1500);
            } catch (error) {
              console.error("FINAL ERROR:", error);
              alert("Report generation failed");
            }
          }
        } catch (error) {
          console.error("Submit Error:", error);
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

    const oldText = answerBox?.value || "";

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
        answerBox.value = oldText;
      }

      return;
    }

    /* ================= SAVE TRANSCRIPT ================= */

    if (answerBox) {
      answerBox.dataset.transcript = data.text;

      answerBox.value = `
${oldText.replace("Analyzing...", "").trim()}
${data.text}
`.trim();
    }
  } catch (error) {
    console.error("Whisper Error:", error);
  }

  audioChunks = [];
}

/* ================= CONFIDENCE ================= */

async function getConfidenceScore() {
  try {
    const res = await fetch("http://localhost:8000/confidence");

    const data = await res.json();

    console.log("Confidence Score:", data.confidence_score);

    return data.confidence_score || 0;
  } catch (err) {
    console.error("Error fetching confidence:", err);

    return 0;
  }
}
