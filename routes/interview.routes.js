const express = require("express");

const router = express.Router();

const { readReport, saveReport } = require("../utils/reportUtils");

/* =========================================
   START INTERVIEW
========================================= */

router.get("/start", (req, res) => {
  try {
    const report = readReport();

    if (!report) {
      return res.status(404).json({
        message: "No report found",
      });
    }

    report.currentQuestion = 0;

    saveReport(report);

    res.json({
      currentQuestion: report.questions[0],

      questions: report.questions,

      total: report.questions.length,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Start interview failed",
    });
  }
});

/* =========================================
   SAVE ANSWER
========================================= */

router.post("/answer", (req, res) => {
  try {
    const { text } = req.body;

    const report = readReport();

    if (!report) {
      return res.status(404).json({
        message: "No report found",
      });
    }

    const currentIndex = report.currentQuestion;

    const currentQ = report.questions[currentIndex];

    if (!report.answers) {
      report.answers = [];
    }

    report.answers.push({
      question: currentQ.question,
      answer: text,
      timestamp: new Date(),
    });

    // MOVE TO NEXT QUESTION
    report.currentQuestion++;

    saveReport(report);

    const nextQuestion = report.questions[report.currentQuestion] || null;

    res.json({
      success: true,
      nextQuestion,
      completed: !nextQuestion,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Answer save failed",
    });
  }
});

/* =========================================
   GET REPORT
========================================= */

router.get("/report", (req, res) => {
  try {
    const report = readReport();

    if (!report) {
      return res.status(404).json({
        message: "No report found",
      });
    }

    res.json(report);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to load report",
    });
  }
});

module.exports = router;
