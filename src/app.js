const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
const session = require("express-session");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const FormData = require("form-data");

const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

const { askAi } = require("./services/openRouter.service");
const User = require("../db/models/User");
const interviewRoutes = require("../routes/interview.routes");
const generatePDF = require("../utils/generatereport");

const app = express();

/* ======================================================
   MIDDLEWARE
====================================================== */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(
  session({
    secret: "intervexa-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

app.use(express.static(path.join(__dirname, "../public")));

app.use("/interview", interviewRoutes);

/* ======================================================
   DIRECTORIES
====================================================== */

const uploadDir = path.join(__dirname, "../upload");
const reportDir = path.join(__dirname, "../reports");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

/* ======================================================
   MULTER
====================================================== */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

/* ======================================================
   GLOBAL SKILLS
====================================================== */

let extractedSkills = [];

/* ======================================================
   HELPERS
====================================================== */

/* ======================================================
   GET LATEST JSON REPORT
====================================================== */

function getLatestReportPath() {
  try {
    if (!fs.existsSync(reportDir)) {
      console.log("Report directory not found");
      return null;
    }

    const files = fs.readdirSync(reportDir);

    console.log("ALL FILES:", files);

    /* ================= ONLY JSON FILES ================= */

    const jsonFiles = files.filter((file) => {
      return file.endsWith(".json") && file.startsWith("report-");
    });

    console.log("JSON FILES:", jsonFiles);

    if (!jsonFiles.length) {
      console.log("No JSON reports found");
      return null;
    }

    /* ================= SORT LATEST ================= */

    const latestFile = jsonFiles
      .map((file) => ({
        name: file,
        time: fs.statSync(path.join(reportDir, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time)[0];

    const finalPath = path.join(reportDir, latestFile.name);

    console.log("LATEST REPORT:", finalPath);

    return finalPath;
  } catch (error) {
    console.error("getLatestReportPath Error:", error);

    return null;
  }
}

function extractSkills(text) {
  const skillList = [
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

  const lowerText = text.toLowerCase();

  return skillList.filter((skill) => lowerText.includes(skill));
}

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
  } catch (error) {
    console.error("PDF Extraction Error:", error);
    return "";
  }
}

async function getConfidenceScore() {
  try {
    const response = await fetch("http://localhost:8000/confidence");

    const data = await response.json();

    return data.confidence_score || 0;
  } catch (error) {
    console.error("Confidence API Error:", error);
    return 0;
  }
}

/* ======================================================
   AUTH ROUTES
====================================================== */

app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const user = new User({
      username,
      email,
      password,
    });

    await user.save();

    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
    };

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      user: req.session.user,
    });
  } catch (error) {
    console.error("Register Error:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required",
      });
    }

    const user = await User.findOne({ email, password });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
    };

    return res.json({
      success: true,
      message: "Login successful",
      user: req.session.user,
    });
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

app.get("/auth-status", (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({
        loggedIn: false,
      });
    }

    return res.json({
      loggedIn: true,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Auth Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check auth status",
    });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout Error:", err);

      return res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }

    res.clearCookie("connect.sid");

    return res.json({
      success: true,
      message: "Logout successful",
    });
  });
});

/* ======================================================
   RESUME UPLOAD
====================================================== */

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const filePath = req.file.path;

    const extractedText = await extractText(filePath);

    extractedSkills = extractSkills(extractedText);

    return res.json({
      success: true,
      message: "Resume uploaded successfully",
      skills: extractedSkills,
    });
  } catch (error) {
    console.error("Upload Error:", error);

    return res.status(500).json({
      success: false,
      message: "Resume upload failed",
    });
  }
});

/* ======================================================
   QUESTION GENERATION
====================================================== */

async function generateQuestions(skills, role, experience, mode, count) {
  try {
    const isHR = mode.toLowerCase().includes("hr");

    const messages = [
      {
        role: "system",
        content: `
You are an expert AI interviewer.

Return ONLY valid JSON array.
No markdown.
No explanation.
No extra text.
`,
      },

      {
        role: "user",
        content: `
Generate EXACTLY ${count} interview questions.

ROLE: ${role}
EXPERIENCE: ${experience}
INTERVIEW TYPE: ${mode}

${
  isHR
    ? `
IMPORTANT:
Generate ONLY HR / behavioral / communication questions.

DO NOT generate:
- coding questions
- programming questions
- technical concepts
- frameworks
- DSA
- system design

Examples:
- Tell me about yourself
- Why do you want this role?
- Describe a challenge you faced
- How do you handle conflict?
`
    : `
IMPORTANT:
Generate ONLY TECHNICAL questions based on these skills.

SKILLS:
${skills?.length ? skills.join(", ") : "General Development"}

Focus on:
- technical concepts
- frameworks
- coding knowledge
- project experience
`
}

Return format:

[
  {
    "type": "${isHR ? "hr" : "technical"}",
    "skill": "${isHR ? "Communication" : "React"}",
    "question": "Question here"
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
  } catch (error) {
    console.error("Question Generation Error:", error);
    return [];
  }
}

app.post("/form", async (req, res) => {
  try {
    const { role, experience, questions, mode } = req.body;

    if (!role || !experience || !questions || !mode) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const generatedQuestions = await generateQuestions(
      extractedSkills,
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
      createdAt: new Date(),
    };

    const fileName = `report-${Date.now()}.json`;

    const reportPath = path.join(reportDir, fileName);

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return res.json({
      success: true,
      message: "Questions generated successfully",
      questions: generatedQuestions,
      reportFile: fileName,
    });
  } catch (error) {
    console.error("Form Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate questions",
    });
  }
});

/* ======================================================
   TRANSCRIBE
====================================================== */

app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No audio uploaded",
      });
    }

    const audioPath = req.file.path;

    const formData = new FormData();

    formData.append("audio", fs.createReadStream(audioPath));

    const response = await fetch("http://localhost:5000/transcribe", {
      method: "POST",
      body: formData,
      headers: formData.getHeaders(),
    });

    const data = await response.json();

    return res.json(data);
  } catch (error) {
    console.error("Transcription Error:", error);

    return res.status(500).json({
      success: false,
      message: "Transcription failed",
    });
  }
});

/* ======================================================
   SAVE ANSWER
====================================================== */

app.post("/save-answer", (req, res) => {
  try {
    const { questionIndex, typedText, transcript } = req.body;

    const reportPath = getLatestReportPath();

    if (!reportPath) {
      return res.status(404).json({
        success: false,
        message: "No report found",
      });
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

    if (!report.answers[questionIndex]) {
      report.answers[questionIndex] = {};
    }

    const finalAnswer = `
${typedText || ""}
${transcript || ""}
`.trim();

    report.answers[questionIndex] = {
      answer: finalAnswer,
      typedText: typedText || "",
      transcript: transcript || "",
      savedAt: new Date(),
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return res.json({
      success: true,
      message: "Answer saved successfully",
    });
  } catch (error) {
    console.error("Save Answer Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save answer",
    });
  }
});

/* ======================================================
   INTERVIEW FEEDBACK
====================================================== */

app.post("/interview-feedback", async (req, res) => {
  try {
    console.log("STARTING FEEDBACK");

    const reportPath = getLatestReportPath();

    if (!reportPath) {
      return res.status(404).json({
        success: false,
        message: "No report found",
      });
    }

    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

    if (!report.answers || report.answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No answers found",
      });
    }

    for (let i = 0; i < report.questions.length; i++) {
      const question = report.questions[i];
      const answer = report.answers[i];

      if (!answer || !answer.answer) continue;

      console.log(`Generating feedback for Q${i + 1}`);

      const messages = [
        {
          role: "system",
          content: `
You are an expert AI interviewer.

Return ONLY valid JSON.

{
  "score": 85,
  "communicationScore": 80,
  "technicalScore": 90,
  "communication": "Clear communication.",
  "technical": "Strong technical knowledge.",
  "strengths": ["Good examples"],
  "improvements": ["Improve structure"],
  "summary": "Strong answer overall.",
  "rating": "Very Good"
}
`,
        },
        {
          role: "user",
          content: `
Question:
${question.question}

Answer:
${answer.answer}
`,
        },
      ];

      try {
        const aiPromise = askAi(messages);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("AI Timeout")), 40000),
        );

        const aiResponse = await Promise.race([aiPromise, timeoutPromise]);

        console.log(`AI RESPONSE RECEIVED Q${i + 1}`);

        const cleaned = aiResponse
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        let feedback;

        try {
          feedback = JSON.parse(cleaned);
        } catch (err) {
          console.log("JSON PARSE FAILED:", cleaned);

          feedback = {
            score: 0,
            communicationScore: 0,
            technicalScore: 0,
            communication: "AI response invalid",
            technical: "AI response invalid",
            strengths: [],
            improvements: ["Retry later"],
            summary: "Could not parse AI response",
            rating: "Error",
          };
        }

        report.answers[i].feedback = feedback;
        report.answers[i].evaluatedAt = new Date();
      } catch (error) {
        console.error(`Feedback Error Q${i + 1}:`, error);

        report.answers[i].feedback = {
          score: 0,
          communicationScore: 0,
          technicalScore: 0,
          communication: "Evaluation failed",
          technical: "Evaluation failed",
          strengths: [],
          improvements: ["Try again later"],
          summary: "Could not evaluate answer",
          rating: "Error",
        };
      }
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log("FEEDBACK DONE");

    return res.json({
      success: true,
      message: "Feedback generated successfully",
      report,
    });
  } catch (error) {
    console.error("INTERVIEW FEEDBACK ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Feedback generation failed",
      error: error.message,
    });
  }
});

/* ======================================================
   VIEW REPORT
====================================================== */
app.get("/view-report", async (req, res) => {
  try {
    const reportPath = getLatestReportPath();

    if (!reportPath) {
      return res.status(404).json({
        success: false,
        message: "No report found",
      });
    }

    const rawData = fs.readFileSync(reportPath, "utf-8");
    const report = JSON.parse(rawData);

    const confidenceScore = await getConfidenceScore();

    const formattedAnswers = (report.answers || []).map((item, index) => {
      return {
        question: report.questions?.[index]?.question || "No Question",
        answer: item.answer || "No Answer",
        feedback: item.feedback || {
          score: 0,
          communicationScore: 0,
          technicalScore: 0,
          summary: "No summary available",
          communication: "No communication feedback",
          technical: "No technical feedback",
        },
      };
    });

    return res.json({
      success: true,

      answers: formattedAnswers,

      stats: {
        confidenceScore: Math.round(confidenceScore),
      },
    });
  } catch (error) {
    console.error("VIEW REPORT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load report",
    });
  }
});
/* ======================================================
   DOWNLOAD PDF REPORT
====================================================== */

app.get("/download-report", async (req, res) => {
  try {
    const reportPath = getLatestReportPath();

    if (!reportPath) {
      return res.status(404).json({
        success: false,
        message: "No report found",
      });
    }

    const confidenceScore = await getConfidenceScore();

    const outputPath = path.join(reportDir, "InterVexa-Report.pdf");

    /* ================= DELETE OLD PDF ================= */

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    /* ================= GENERATE NEW PDF ================= */

    await generatePDF(reportPath, outputPath, confidenceScore);

    /* ================= SEND PDF ================= */

    return res.download(outputPath);
  } catch (error) {
    console.error("DOWNLOAD REPORT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Download failed",
      error: error.message,
    });
  }
});
/* ======================================================
   EXPORT
====================================================== */

module.exports = app;
