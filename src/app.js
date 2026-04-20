const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
const { askAi } = require("./services/openRouter.service");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const User = require("../db/models/User");
const session = require("express-session");
const app = express();

/* ======================= MIDDLEWARE ======================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, "../public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); // 🔥 go to root

/* ======================= SESSION ======================= */

app.use(
  session({
    secret: "intervexa-secret", // change this to something strong
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // true only if using HTTPS
      httpOnly: true,
    },
  }),
);

app.get("/auth-status", (req, res) => {
  if (req.session && req.session.user) {
    return res.json({
      loggedIn: true,
      user: req.session.user,
    });
  }

  return res.json({ loggedIn: false });
});

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
  try {
    const { role, experience, mode, Number } = req.body;

    const parameter = `${role} with ${experience} experience - ${mode}`;

    const questions = await generateQuestions(skills, role, experience, mode);

    const report = {
      role,
      experience,
      mode,
      questions,
      answers: [],
      currentQuestion: 0,
      createdAt: new Date(),
    };

    const fileName = `report-${Date.now()}.json`;
    const reportPath = path.join(reportDir, fileName);

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    res.json({ questions });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to generate questions",
    });
  }
});

const generateQuestions = async (skills, role, experience, mode, count) => {
  const messages = [
    {
      role: "system",
      content:
        "You are an expert interview question generator that strictly follows output rules.",
    },
    {
      role: "user",
      content: `
Generate EXACTLY ${count} interview questions.

Candidate Details:
Role: ${role}
Experience: ${experience} years
Mode: ${mode}

Skills:
${skills.join(", ")}

STRICT RULES:
- Generate EXACTLY ${count} questions (no more, no less)
- Do NOT repeat questions
- If mode = technical → only technical questions
- If mode = HR → only behavioral questions
- Match difficulty to experience level
- Each question must map to a skill when possible
- Return ONLY valid JSON (no markdown, no explanation)

OUTPUT FORMAT:
[
  {
    "type": "technical",
    "skill": "React",
    "question": "Explain Virtual DOM in React"
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

    if (!files.length) {
      return res.status(400).json({
        message: "No report found",
      });
    }

    const latestFile = files
      .map((file) => ({
        name: file,
        time: fs.statSync(path.join(reportDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)[0];

    if (!latestFile) {
      return res.status(400).json({
        message: "No latest report",
      });
    }

    const reportPath = path.join(reportDir, latestFile.name);

    const report = JSON.parse(fs.readFileSync(reportPath));

    report.currentQuestion = 0;

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    res.json({
      question: report.questions[0],
      total: report.questions.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Start error");
  }
});

app.post("/nextquestion", (req, res) => {
  try {
    const files = fs.readdirSync(reportDir);

    if (!files.length) {
      return res.status(400).json({
        message: "No report found",
      });
    }

    const latestFile = files
      .map((file) => ({
        name: file,
        time: fs.statSync(path.join(reportDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)[0];

    const reportPath = path.join(reportDir, latestFile.name);

    const report = JSON.parse(fs.readFileSync(reportPath));

    report.currentQuestion += 1;

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    if (report.currentQuestion < report.questions.length) {
      res.json({
        question: report.questions[report.currentQuestion],
        index: report.currentQuestion,
      });
    } else {
      res.json({
        message: "Interview Completed",
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Next Question Error");
  }
});

app.post("/interview-answer", (req, res) => {
  try {
    const { text } = req.body;

    const files = fs.readdirSync(reportDir);
    if (!files.length) {
      return res.status(400).json({ error: "No report found" });
    }

    const latestFile = files
      .map((file) => ({
        name: file,
        time: fs.statSync(path.join(reportDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)[0];

    const reportPath = path.join(reportDir, latestFile.name);
    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

    const currentQ = report.questions[report.currentQuestion];

    // ✅ SAVE ANSWER HERE
    const answerObj = {
      question: currentQ.question,
      answer: text,
      timestamp: new Date(),
    };

    report.answers.push(answerObj);

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    res.json({
      success: true,
      saved: true,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Answer save error");
  }
});

/* ======================= FEEDBACK ======================= */

app.post("/interview-feedback", async (req, res) => {
  try {
    // ✅ Get latest report
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

    const currentIndex = report.currentQuestion - 1;
    const currentQ = report.questions[currentIndex];

    if (!currentQ) {
      return res.json({
        message: "Interview Completed",
      });
    }

    const lastAnswer = report.answers?.[report.answers.length - 1];
    const transcript = lastAnswer?.answer;

    if (!transcript) {
      return res.status(400).json({
        message: "No answer found",
      });
    }

    // ✅ Better prompt (STRICT JSON)
    const messages = [
      {
        role: "system",
        content:
          "You are a strict technical interviewer. Always return valid JSON only.",
      },
      {
        role: "user",
        content: `
Evaluate the following answer.

Question:
${currentQ.question}

Answer:
${transcript}

Return ONLY valid JSON. No explanation, no markdown.

Format:
{
  "score": number (0-10),
  "communication": "string",
  "technical": "string",
  "strengths": ["point1", "point2"],
  "improvements": ["point1", "point2"]
}
        `,
      },
    ];

    const aiResponse = await askAi(messages);

    console.log("🧠 Raw AI Response:", aiResponse);

    // ✅ Extract JSON safely
    let feedback;

    try {
      const match = aiResponse.match(/{[\s\S]*}/);

      if (!match) {
        throw new Error("No JSON found in AI response");
      }

      const cleaned = match[0]
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      feedback = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("❌ JSON Parse Failed:", aiResponse);

      // ✅ Fallback so UI never breaks
      feedback = {
        score: 5,
        communication: "Could not properly analyze communication.",
        technical: "Could not properly analyze technical depth.",
        strengths: ["Answer received but formatting issue occurred"],
        improvements: ["Ensure structured response and clarity"],
      };
    }

    // ✅ Save feedback
    lastAnswer.feedback = feedback;
    lastAnswer.evaluatedAt = new Date();

    // ✅ Move to next question
    report.currentQuestion += 1;

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

    res.json({
      feedback,
      nextQuestion: report.questions[report.currentQuestion] || null,
    });
  } catch (error) {
    console.error("🔥 Feedback Error:", error);

    res.status(500).json({
      message: "Feedback processing failed",
    });
  }
});
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const generatePDF = require("../generatereport");

async function getConfidenceScore() {
  try {
    const res = await fetch("http://localhost:8000/confidence");
    const data = await res.json();

    console.log("🎯 Confidence Score:", data.confidence_score);

    return data.confidence_score || 0;
  } catch (err) {
    console.error("❌ Error fetching confidence:", err);
    return 0;
  }
}

// ✅ STRICTLY ONLY JSON FILES
function getLatestReport() {
  const dir = path.join(__dirname, "..", "reports");

  if (!fs.existsSync(dir)) {
    throw new Error("Reports folder not found");
  }

  const files = fs.readdirSync(dir);

  const jsonFiles = files.filter(
    (f) => f.endsWith(".json") && f !== "report.pdf",
  );

  if (!jsonFiles.length) {
    throw new Error("No JSON reports found");
  }

  const latest = jsonFiles
    .map((file) => ({
      name: file,
      time: fs.statSync(path.join(dir, file)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time)[0].name;

  return path.join(dir, latest);
}
app.get("/report", async (req, res) => {
  try {
    const reportPath = getLatestReport();
    const confidenceScore = await getConfidenceScore();

    const reportData = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

    console.log("DEBUG DATA:", reportData); // optional debug

    res.render("report", {
      answers: reportData.answers || [],
      confidence: confidenceScore,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});
app.get("/download-pdf", async (req, res) => {
  try {
    const reportDir = path.join(__dirname, "..", "reports");
    const reportPath = getLatestReport();

    const confidenceScore = await getConfidenceScore();
    const outputPath = path.join(reportDir, "report.pdf");

    await generatePDF(reportPath, outputPath, confidenceScore);

    return res.download(outputPath, "report.pdf");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.send("All fields are required");
    }

    const existing = await User.findOne({ email });
    if (existing) return res.send("User already exists");

    const newUser = new User({ username, email, password });
    await newUser.save();

    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.send("Error saving user");
  }
});

app.get("/redirect", (req, res) => {
  res.redirect("interview.html");
});

/* ================= LOGIN ================= */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });

    if (!user) return res.send("Invalid email or password ❌");

    req.session.user = user;

    res.redirect("/index.html");
  } catch (err) {
    console.error(err);
    res.send("Login error");
  }
});
// ================= AUTH STATUS =================
app.get("/auth-status", (req, res) => {
  if (req.session.user) {
    res.json({
      loggedIn: true,
      user: {
        username: req.session.user.username,
        email: req.session.user.email,
      },
    });
  } else {
    res.json({ loggedIn: false });
  }
});

/* ================= LOGOUT ================= */
app.get("/logout", (req, res) => {
  req.logout?.(() => {});
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destroy error:", err);
      return res.status(500).send("Logout failed");
    }
    res.clearCookie("connect.sid");
    res.redirect("/index.html");
  });
});

app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const audioPath = req.file.path;

    const formData = new FormData();
    formData.append("audio", fs.createReadStream(audioPath));

    const response = await fetch("http://localhost:5000/transcribe", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Transcription failed" });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout Error:", err);
      return res.send("Error logging out");
    }

    res.clearCookie("connect.sid"); // 🔥 remove session cookie
    res.redirect("/index.html"); // or "/"
  });
});

module.exports = app;
