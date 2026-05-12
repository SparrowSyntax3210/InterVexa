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

const uploadBox = document.getElementById("uploadBox");
const resumeUpload = document.getElementById("resumeUpload");
const resumeText = document.getElementById("resumeText");
const analyzeBtn = document.getElementById("analyzeBtn");
const analysisResult = document.getElementById("analysisResult");

const interviewForm = document.getElementById("interviewForm");

let resumeFile = null;

/* ================= Resume Upload ================= */

uploadBox.addEventListener("click", () => {
  resumeUpload.click();
});

// File selected
resumeUpload.addEventListener("change", (e) => {
  resumeFile = e.target.files[0];

  if (resumeFile) {
    resumeText.innerText = resumeFile.name;
  }
});

/* ================= Analyze Resume ================= */

analyzeBtn.addEventListener("click", async (e) => {
  e.stopPropagation();

  if (!resumeFile) {
    alert("Please upload your resume first");
    return;
  }

  try {
    analyzeBtn.innerText = "Analyzing...";

    const formData = new FormData();
    formData.append("file", resumeFile);

    const response = await fetch("http://localhost:4000/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    console.log(data);

    analysisResult.innerHTML = `
      <div class="analysis-card">
        <h3>Resume Analysis</h3>

        <p><strong>Skills Found:</strong></p>

        <div class="skills-box">
          ${
            data.skills?.length
              ? data.skills
                  .map((skill) => `<span class="skill-tag">${skill}</span>`)
                  .join("")
              : "<p>No skills detected</p>"
          }
        </div>
      </div>
    `;

    analyzeBtn.innerText = "Analyzed successfully";
  } catch (error) {
    console.error("Resume Analysis Error:", error);

    analyzeBtn.innerText = "Analyze Resume";

    alert("Resume analysis failed");
  }
});

/* ================= Generate Questions ================= */

interviewForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const role = interviewForm.querySelector('input[type="text"]').value.trim();

  const experience = interviewForm
    .querySelector(".input-group select")
    .value.trim();

  const questions = interviewForm
    .querySelector('input[type="number"]')
    .value.trim();

  const mode = interviewForm.querySelectorAll("select")[1].value;

  if (!role || !experience || !questions) {
    alert("Please fill all fields");

    return;
  }

  const submitBtn = interviewForm.querySelector('button[type="submit"]');

  try {
    submitBtn.innerText = "Generating...";
    submitBtn.disabled = true;

    const response = await fetch("http://localhost:4000/form", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        role,
        experience,
        questions,
        mode,
      }),
    });

    const data = await response.json();

    console.log("SERVER:", data);

    if (!response.ok) {
      throw new Error(data.message || "Generation failed");
    }

    submitBtn.style.display = "none";
    // submitBtn.disabled = false;

    askAIVoice(`Your ${mode} interview is ready`);

    console.log(data.questions);
  } catch (error) {
    console.error("Frontend Error:", error);

    submitBtn.innerText = "Generate Again";

    submitBtn.disabled = false;

    alert(error.message);
  }
});

document.getElementById("Redirect").addEventListener("click", () => {
  window.location.href = "/interview.html";
});

/* ================= Smooth Animations ================= */

const cards = document.querySelectorAll(".card");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show-card");
      }
    });
  },
  {
    threshold: 0.2,
  },
);

cards.forEach((card) => {
  observer.observe(card);
});

/* ================= Navbar Blur ================= */

window.addEventListener("scroll", () => {
  const nav = document.querySelector(".nav");

  if (window.scrollY > 40) {
    nav.classList.add("nav-scrolled");
  } else {
    nav.classList.remove("nav-scrolled");
  }
});

/* ================= Marquee Duplicate ================= */

const marquee = document.getElementById("marquee-content");

if (marquee) {
  marquee.innerHTML += marquee.innerHTML;
}
