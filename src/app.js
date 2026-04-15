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

app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  const newUser = new User({
    username,
    email,
    password,
  });

  await newUser.save();

  res.send("User Created");
});

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

const generateQuestions = async (skills, role, experience, mode, Number) => {
  const messages = [
    {
      role: "system",
      content: "You are an expert interview question generator",
    },
    {
      role: "user",
      content: `
Generate ${mode} interview questions.

Candidate Details:
Role: ${role}
Experience: ${experience}
Number : ${Number}

Skills:
${skills.join(", ")}

Rules:
- Generate Number interview questions
- If mode is technical → technical questions
- If mode is HR → behavioral questions
- Questions should match experience level
- Return JSON only

Format:
[
{
"type":"technical",
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

app.post("/interview-answer", async (req, res) => {
  try {
    const { text } = req.body;

    const files = fs.readdirSync(reportDir);

    if (!files.length) {
      return res.json({
        answer: "No report found",
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

    const current = report.questions[report.currentQuestion];

    res.json({
      question: current.question,
      answer: current.answer,
      userAnswer: text,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Answer error");
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

    const currentQ = report.questions[report.currentQuestion - 1];

    if (!currentQ) {
      return res.json({
        message: "Interview Completed",
      });
    }

    const lastAnswer = report.answers[report.answers.length - 1];
    const transcript = lastAnswer?.answer;

    if (!transcript) {
      return res.status(400).json({
        message: "No answer found",
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

    const cleaned = aiResponse
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const feedback = JSON.parse(cleaned);

    lastAnswer.feedback = feedback;
    lastAnswer.time = new Date();

    report.currentQuestion += 1;

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

    res.json({
      feedback,
      nextQuestion: report.questions[report.currentQuestion] || null,
    });
  } catch (error) {
    console.error("Feedback Error:", error);
    res.status(500).send("Feedback error");
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

    await new User({ username, email, password }).save();

    res.redirect("/login.html");
  } catch (err) {
    console.error(err);
    res.send("Error saving user");
  }
});

app.use((req, res, next) => {
  console.log("SESSION EXISTS?", !!req.session);
  next();
});

app.post("/login", async (req, res) => {
  try {
    console.log("BODY:", req.body);

    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).send("Email and password required");
    }

    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res.send("Invalid email or password ❌");
    }

    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
    };

    return res.redirect("/index.html"); // ✅ fixed
  } catch (err) {
    console.error(err);
    res.status(500).send("Login error");
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
