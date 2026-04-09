const express = require("express");
const { upload } = require("../middlewares/multer.js");
const {
  analyzeResume,
  finishInterview,
  generateQuestion,
  getInterviewReport,
  getMyInterviews,
  submitAnswer,
} = require("../src/interview.controller.js");

const interviewRouter = express.Router();

interviewRouter.post("/resume", upload.single("resume"), analyzeResume);
interviewRouter.post("/generate-questions", generateQuestion);
interviewRouter.post("/submit-answer", submitAnswer);
interviewRouter.post("/finish", finishInterview);

interviewRouter.get("/get-interview", getMyInterviews);
interviewRouter.get("/report/:id", getInterviewReport);

module.exports = interviewRouter;
