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

const generateQuestions = async (skills) => {
  const messages = [
    {
      role: "system",
      content: "You are interview question generator",
    },
    {
      role: "user",
      content: `
Generate interview questions based on:

${skills.join(", ")}

Rules:
- Generate only 1 interview question 
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

/* ======================= UPLOAD ROUTE ======================= */

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;

    const text = await extractText(filePath);

    const skills = extractSkills(text);

    const questions = await generateQuestions(skills);

    const report = {
      file: req.file.filename,
      skills,
      questions,
      createdAt: new Date(),
      currentQuestion: 0,
      answers: [],
    };

    const reportPath = path.join(reportDir, `${Date.now()}-report.json`);

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    res.json({
      message: "Resume Analyzed",
      skills,
      questions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Upload error");
  }
});

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

    res.json({
      question: report.questions[0],
      total: report.questions.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Start error");
  }
});

/* ======================= FEEDBACK ======================= */

app.post("/interview-feedback", async (req, res) => {
  try {
    const transcript = req.body.text;

    const files = fs.readdirSync(reportDir);

    const latest = files
      .map((file) => ({
        name: file,
        time: fs.statSync(path.join(reportDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)[0].name;

    const reportPath = path.join(reportDir, latest);

    const report = JSON.parse(fs.readFileSync(reportPath));

    const currentQ = report.questions[report.currentQuestion];

    if (!currentQ) {
      return res.json({
        message: "Interview Completed",
      });
    }

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

    let feedback;

    const cleaned = aiResponse
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    feedback = JSON.parse(cleaned);

    report.answers.push({
      question: currentQ.question,
      answer: transcript,
      feedback,
      time: new Date(),
    });

    report.currentQuestion += 1;

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    res.json({
      feedback,
      nextQuestion: report.questions[report.currentQuestion] || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Feedback error");
  }
});

module.exports = app;
