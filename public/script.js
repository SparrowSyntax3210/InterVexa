/* ================= GSAP SETUP ================= */
gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

/* ================= LOADER ================= */
document.addEventListener("DOMContentLoaded", () => {
  handleAuthUI();
  const tl = gsap.timeline({
    onComplete: initSmoothScroll,
  });

  tl.set(".loader-container", { autoAlpha: 1 })
    .to({}, { duration: 0.8 })
    .to(".loader-text-fill", {
      y: -60,
      opacity: 0,
      duration: 0.5,
    })
    .to(".loader-container", {
      yPercent: -100,
      duration: 0.8,
    })
    .set(".loader-container", { display: "none" })
    .from(".nav img, .nav h4, .floating, .fill-btn", {
      y: 80,
      opacity: 0,
      duration: 0.9,
      stagger: 0.12,
    });

  initAuthUI();
  initLogin();
});

/* ================= SMOOTH SCROLL ================= */
function initSmoothScroll() {
  ScrollSmoother.create({
    wrapper: "#smooth-wrapper",
    content: "#smooth-content",
    smooth: 1.2,
    effects: true,
  });

  initAnimations();
}

/* ================= ANIMATIONS ================= */
function initAnimations() {
  gsap.from(".card", {
    opacity: 0,
    y: 60,
    stagger: 0.2,
    scrollTrigger: {
      trigger: ".about",
      start: "top 60%",
    },
  });
}

/* ================= LOGIN ================= */
function initLogin() {
  const form = document.querySelector("form");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = form.email.value.trim();
    const password = form.password.value.trim();

    if (!email || !password) {
      alert("Enter email & password");
      return;
    }

    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        window.location.href = data.redirect || "/index.html";
      } else {
        alert(data.message || "Login failed");
      }
    } catch (err) {
      console.error("Login Error:", err);
      alert("Server error");
    }
  });
}

/* ================= AUTH UI ================= */
function initAuthUI() {
  const profile = document.getElementById("profileCircle");

  if (!profile || !btn) return;

  fetch("/auth-status", { credentials: "include" })
    .then((res) => res.json())
    .then((data) => {
      profile.style.display = data.loggedIn ? "flex" : "none";
      btn.style.display = data.loggedIn ? "none" : "inline-block";
    })
    .catch(() => {
      profile.style.display = "none";
      btn.style.display = "inline-block";
    });
}

/* ================= PROFILE DROPDOWN ================= */
const avatar = document.querySelector(".avatar");
const dropdown = document.querySelector(".dropdown");

if (avatar) {
  avatar.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.style.display =
      dropdown.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", () => {
    dropdown.style.display = "none";
  });
}

function handleAuthUI() {
  const profile = document.getElementById("profileCircle");
  const getStartedBtn = document.querySelector("#getStartedBtn");

  if (!profile || !getStartedBtn) return;

  fetch("/auth-status", {
    credentials: "include",
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.loggedIn) {
        profile.classList.remove("hidden");
        getStartedBtn.classList.add("hidden");
      } else {
        profile.classList.add("hidden");
        getStartedBtn.classList.remove("hidden");
      }
    });
}

/* ================= RESUME UPLOAD ================= */
let resumeFile = null;

const uploadBox = document.getElementById("uploadBox");
const resumeUpload = document.getElementById("resumeUpload");
const resumeText = document.getElementById("resumeText");

if (uploadBox && resumeUpload) {
  uploadBox.addEventListener("click", () => resumeUpload.click());

  resumeUpload.addEventListener("change", (e) => {
    resumeFile = e.target.files[0];
    if (resumeFile) resumeText.innerText = resumeFile.name;
  });
}

/* ================= ANALYZE RESUME ================= */
const analyzeBtn = document.getElementById("analyzeBtn");

if (analyzeBtn) {
  analyzeBtn.addEventListener("click", async (e) => {
    e.stopPropagation();

    if (!resumeFile) {
      alert("Upload resume first");
      return;
    }

    analyzeBtn.innerText = "Analyzing...";

    const formData = new FormData();
    formData.append("file", resumeFile);

    const res = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    document.getElementById("analysisResult").innerHTML = `
      <h3>Skills</h3>
      ${data.skills.map((s) => `<span>${s}</span>`).join("")}
    `;

    analyzeBtn.innerText = "Done ✅";
  });
}

/* ================= START INTERVIEW ================= */
const startInterviewBtn = document.getElementById("startInterview");

if (startInterviewBtn) {
  startInterviewBtn.addEventListener("click", async () => {
    const res = await fetch("/start-interview", { method: "POST" });
    const data = await res.json();

    document.getElementById("question").innerText = data.question.question;
  });
}

/* ================= NEXT QUESTION ================= */
const nextBtn = document.getElementById("nextquestion");

if (nextBtn) {
  nextBtn.addEventListener("click", async () => {
    const res = await fetch("/nextquestion", { method: "POST" });
    const data = await res.json();

    document.getElementById("question").innerText =
      data.question?.question || data.message;
  });
}

/* ================= VOICE ================= */
function askAIVoice(text) {
  const synth = window.speechSynthesis;
  synth.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.9;

  synth.speak(utter);
}

/* ================= LOGOUT ================= */
function logoutUser() {
  window.location.href = "/";
}
