const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
const { askAi } = require("./services/openRouter.service");
const app = express();
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(express.static(path.join(__dirname, "../public")));

app.set("view engine", "ejs");

/* ======================= FOLDERS ======================= */

const uploadDir = path.join(process.cwd(), "upload");
const reportDir = path.join(process.cwd(), "reports");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);

/* ======================= MULTER ======================= */

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

/* ======================= PDF TEXT EXTRACTION ======================= */

async function extractText(filePath) {
  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      text += content.items.map((item) => item.str).join(" ") + "\n";
    }

    if (!text.trim()) throw new Error("Unreadable PDF");

    return text;
  } catch (err) {
    console.error("PDF Extraction Error:", err);
    return "";
  }
}

/* ======================= SKILL EXTRACTION ======================= */

function extractSkills(text) {
  const skills = [
    "javascript",
    "react",
    "node",
    "express",
    "mongodb",
    "mysql",
    "html",
    "css",
    "git",
    "github",
    "python",
    "java",
    "c++",
  ];

  const lower = text.toLowerCase();

  return skills.filter((skill) => lower.includes(skill));
}

/* ======================= AI QUESTION GENERATION ======================= */

const generateQuestions = async (skills) => {
  const messages = [
    {
      role: "system",
      content: "You are an interview question generator.",
    },
    {
      role: "user",
      content: `Generate interview questions based on these skills: ${skills.join(
        ", ",
      )}

Rules:
- Generate 2 questions per skill
- Return JSON only

Format:
[
{
"skill":"JavaScript",
"question":"Explain closures"
}
]`,
    },
  ];

  const response = await askAi(messages);

  return JSON.parse(response);
};

/* ======================= ROUTE ======================= */

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const filePath = req.file.path;

    const text = await extractText(filePath);

    const skills = extractSkills(text);

    console.log("Extracted Skills:", skills);

    const questions = await generateQuestions(skills);

    const report = {
      file: req.file.filename,
      skills,
      questions,
      createdAt: new Date(),
    };

    const reportPath = path.join(reportDir, `${Date.now()}-report.json`);

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    res.json({
      message: "Analysis Complete",
      skills,
      questions,
      report,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error uploading file");
  }
});

app.post("/start-interview", async (req, res) => {
  try {
    const reportDir = path.join(process.cwd(), "reports");

    const files = fs.readdirSync(reportDir);

    if (!files.length) {
      return res.status(400).json({
        message: "No resume analyzed yet",
      });
    }

    // Get latest report
    const latestReport = files
      .map((file) => ({
        name: file,
        time: fs.statSync(path.join(reportDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)[0].name;

    const reportPath = path.join(reportDir, latestReport);

    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

    const skills = report.skills;

    if (!skills || skills.length === 0) {
      return res.status(400).json({
        message: "No skills found in report",
      });
    }

    const messages = [
      {
        role: "system",
        content: "You are a technical interviewer.",
      },
      {
        role: "user",
        content: `Generate interview questions based on these skills: ${skills.join(", ")}

Rules:
- Generate 2 questions per skill
- Return JSON only

Format:
[
{
"skill":"React",
"question":"Explain Virtual DOM"
}
]`,
      },
    ];

    const aiResponse = await askAi(messages);

    let questions;

    try {
      questions = JSON.parse(aiResponse);
    } catch {
      questions = [];
    }

    res.json({
      message: "Interview Started",
      skills,
      questions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error starting interview",
    });
  }
});

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

    console.log("User Speech:", data.text);

    handleUserAnswer(data.text);
  } catch (error) {
    console.error("Speech error:", error);
  }

  audioChunks = [];
}

module.exports = app;
