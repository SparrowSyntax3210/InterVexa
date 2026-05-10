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
const interviewRoutes = require("../routes/interview.routes");
/* ======================= MIDDLEWARE ======================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use("/interview", interviewRoutes);
app.use(express.static(path.join(__dirname, "../public")));

/* ======================= SESSION ======================= */

app.use(
  session({
    secret: "intervexa-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
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

// ================= GENERATE INTERVIEW =================

app.post("/form", async (req, res) => {
  try {
    const { role, experience, questions, mode } = req.body;

    if (!role || !experience || !questions || !mode) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    console.log("Incoming Form Data:");

    console.log({
      role,
      experience,
      questions,
      mode,
    });

    const generatedQuestions = await generateQuestions(
      skills,
      role,
      experience,
      mode,
      questions,
    );

    const report = {
      role,
      experience,
      totalQuestions: questions,
      mode,

      questions: generatedQuestions,

      answers: [],

      currentQuestion: 0,

      createdAt: new Date(),
    };

    const fileName = `report-${Date.now()}.json`;

    const reportPath = path.join(reportDir, fileName);

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log("Report Saved");

    res.status(200).json({
      success: true,
      message: "Questions Generated",
      questions: generatedQuestions,
      reportFile: fileName,
    });
  } catch (error) {
    console.error("Question Generation Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate questions",
    });
  }
});

// ================= AI QUESTION GENERATOR =================

const generateQuestions = async (skills, role, experience, mode, count) => {
  try {
    const messages = [
      {
        role: "system",

        content:
          "You are an expert AI interviewer that generates professional interview questions.",
      },

      {
        role: "user",

        content: `

Generate EXACTLY ${count} interview questions.

CANDIDATE DETAILS:

Role: ${role}

Experience: ${experience} years

Interview Type: ${mode}

Skills:
${skills?.length ? skills.join(", ") : "General Development"}


STRICT RULES:

- Generate EXACTLY ${count} questions
- No repeated questions
- Keep questions concise
- Match difficulty according to experience
- Technical Interview → only technical questions
- HR Interview → only HR/behavioral questions
- Return ONLY valid JSON
- No markdown
- No explanation


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

    const parsedQuestions = JSON.parse(cleaned);

    return parsedQuestions;
  } catch (error) {
    console.error("AI Question Generation Failed:", error);

    return [];
  }
};
/* ======================= START INTERVIEW ======================= */

function getLatestReportPath() {
  const files = fs.readdirSync(reportDir);

  if (!files.length) {
    return null;
  }

  const latestFile = files
    .map((file) => ({
      name: file,
      time: fs.statSync(path.join(reportDir, file)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time)[0];

  return path.join(reportDir, latestFile.name);
}

app.post("/interview-feedback", async (req, res) => {
  try {
    /* ================= GET REPORT ================= */

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

    /* ================= VALIDATION ================= */

    if (!report.answers || !report.answers.length) {
      return res.status(400).json({
        message: "No answers found",
      });
    }

    /* ================= FEEDBACK ARRAY ================= */

    if (!report.feedbacks) {
      report.feedbacks = [];
    }

    /* ================= LOOP THROUGH ANSWERS ================= */

    for (let i = 0; i < report.answers.length; i++) {
      const answerData = report.answers[i];

      const questionData = report.questions[i];

      /* ===== SKIP EMPTY ANSWERS ===== */

      if (!answerData || !answerData.answer) {
        continue;
      }

      /* ===== SKIP ALREADY EVALUATED ===== */

      if (answerData.feedback) {
        continue;
      }

      /* ================= AI PROMPT ================= */

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
${questionData?.question || "Unknown Question"}

Answer:
${answerData.answer}

Return ONLY valid JSON.

Format:
{
  "score": number,
  "communication": "string",
  "technical": "string",
  "strengths": ["point1", "point2"],
  "improvements": ["point1", "point2"]
  "ratings": [20/100]
}
          `,
        },
      ];

      /* ================= ASK AI ================= */

      const aiResponse = await askAi(messages);

      console.log("Raw AI Response:", aiResponse);

      let feedback;

      /* ================= PARSE ================= */

      try {
        const match = aiResponse.match(/{[\s\S]*}/);

        if (!match) {
          throw new Error("No JSON found");
        }

        const cleaned = match[0]
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        feedback = JSON.parse(cleaned);
      } catch (parseError) {
        console.error("JSON Parse Failed:", aiResponse);

        feedback = {
          score: 5,
          communication: "Could not properly analyze communication.",
          technical: "Could not properly analyze technical depth.",
          strengths: ["Answer received"],
          improvements: ["Provide more structured answers"],
        };
      }

      /* ================= SAVE FEEDBACK ================= */

      answerData.feedback = feedback;

      answerData.evaluatedAt = new Date();

      report.feedbacks.push({
        question: questionData?.question,
        feedback,
      });
    }

    /* ================= COMPLETE ================= */

    report.completed = true;

    report.completedAt = new Date();

    /* ================= SAVE REPORT ================= */

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");

    console.log("All Feedback Saved");

    /* ================= RESPONSE ================= */

    res.json({
      success: true,

      message: "Feedback generated successfully",

      report,
    });
  } catch (error) {
    console.error("🔥 Feedback Error:", error);

    res.status(500).json({
      message: "Feedback processing failed",
    });
  }
});

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

app.get("/download-report", async (req, res) => {
  try {
    const reportDir = path.join(__dirname, "..", "reports");

    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
      return res.status(400).send("No reports available yet");
    }

    const reportPath = getLatestReport();

    console.log("Using JSON report:", reportPath);

    const confidenceScore = await getConfidenceScore();

    const outputPath = path.join(reportDir, "report.pdf");

    console.log("Confidence:", confidenceScore);

    generatePDF(reportPath, outputPath, confidenceScore);
    setTimeout(() => {
      if (fs.existsSync(outputPath)) {
        return res.download(outputPath);
      } else {
        return res.status(500).send("PDF generation failed");
      }
    }, 700);
  } catch (error) {
    console.error("PDF Error:", error);
    return res.status(500).send(error.message);
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

/* ================= LOGIN ================= */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });

    if (!user) return res.send("Invalid email or password ");

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

module.exports = app;
