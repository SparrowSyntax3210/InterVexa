const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
const { askAi } = require("./services/openRouter.service");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

const app = express();

/* ======================= MIDDLEWARE ======================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(express.static(path.join(__dirname, "../public")));

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

    return text;
  } catch (err) {
    console.error("PDF Error:", err);
    return "";
  }
}

/* ======================= UPLOAD ROUTE ======================= */

let skills = [];

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;

    const text = await extractText(filePath);

    skills = extractSkills(text);

    console.log("Extracted Skills:", skills);

    res.json({
      message: "Resume uploaded successfully",
      skills,
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* ======================= SKILLS ======================= */

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

/* ======================= QUESTION GENERATION ======================= */

app.post("/form", async (req, res) => {
  const { role, experience, mode } = req.body;
  console.log(role, experience, mode);

  const parameter = `${role} with ${experience} - ${mode}`;

  const questions = await generateQuestions(skills, parameter);

  res.json({ questions });
});

const generateQuestions = async (skills, parameter) => {
  const messages = [
    {
      role: "system",
      content: "You are interview question generator",
    },
    {
      role: "user",
      content: `
Generate interview for ${parameter};

Generate interview questions based on:

${skills.join(", ")}

Rules:
- Generate only 3 interview question 
- Return JSON only

Format:
[
{
"skill":"React",
"question":"Explain Virtual DOM"
}
]
`,
    },
  ];

  const response = await askAi(messages);

  const cleaned = response
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleaned);
};

/* ======================= START INTERVIEW ======================= */

app.post("/start-interview", async (req, res) => {
  try {
    const files = fs.readdirSync(reportDir);

    const latest = files
      .map((file) => ({
        name: file,
        time: fs.statSync(path.join(reportDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)[0].name;

    const reportPath = path.join(reportDir, latest);

    const report = JSON.parse(fs.readFileSync(reportPath));

    questions = report.questions;
    currentQuestionIndex = 0;

    res.json({
      question: questions[0],
      total: questions.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Start error");
  }
});

app.post("/nextquestion", (req, res) => {
  try {
    const files = fs.readdirSync(reportDir);

    const latest = files
      .map((file) => ({
        name: file,
        time: fs.statSync(path.join(reportDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)[0].name;

    const reportPath = path.join(reportDir, latest);

    const report = JSON.parse(fs.readFileSync(reportPath));

    report.currentQuestion += 1;

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    if (report.currentQuestion < report.questions.length) {
      res.json({
        question: report.questions[report.currentQuestion],
        index: report.currentQuestion,
      });
    } else {
      report.currentQuestionIndex = 0;
      res.json({
        message: "Interview Completed",
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Next Question Error");
  }
});

/* ======================= FEEDBACK ======================= */

app.post("/interview-feedback", async (req, res) => {
  try {
    const files = fs.readdirSync(reportDir);

    if (!files.length) {
      return res.status(400).json({
        message: "No report found",
      });
    }

    const latest = files
      .map((file) => ({
        name: file,
        time: fs.statSync(path.join(reportDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)[0].name;

    const reportPath = path.join(reportDir, latest);

    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

    console.log("Loaded Report ↓↓↓");
    console.log(JSON.stringify(report, null, 2));

    /* FIXED INDEX */

    const currentQ = report.questions[report.currentQuestion - 1];

    console.log("Current Question:", currentQ);

    if (!currentQ) {
      return res.json({
        message: "Interview Completed",
      });
    }

    /* GET LAST ANSWER */

    const lastAnswer = report.answers[report.answers.length - 1];

    const transcript = lastAnswer?.answer;

    console.log("Transcript:", transcript);

    if (!transcript) {
      return res.status(400).json({
        message: "No answer found",
      });
    }

    /* AI FEEDBACK */

    const messages = [
      {
        role: "system",
        content: "You are technical interviewer",
      },
      {
        role: "user",
        content: `
Question:
${currentQ.question}

Answer:
${transcript}

Return JSON:
{
"score":,
"strengths":"",
"improvements":""
}
`,
      },
    ];

    const aiResponse = await askAi(messages);

    console.log("AI Raw Response:", aiResponse);

    const cleaned = aiResponse
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const feedback = JSON.parse(cleaned);

    console.log("Parsed Feedback:", feedback);

    /* UPDATE REPORT */

    lastAnswer.feedback = feedback;
    lastAnswer.time = new Date();

    report.currentQuestion += 1;

    console.log("Saving to:", reportPath);

    /* SAVE TO SAME FOLDER */

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

    console.log("Report Saved Successfully ✅");

    res.json({
      feedback,
      nextQuestion: report.questions[report.currentQuestion] || null,
    });
  } catch (error) {
    console.error("Feedback Error:", error);
    res.status(500).send("Feedback error");
  }
});

module.exports = app;
