const express = require("express");
const app = express();
const path = require("path");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const cors = require("cors");
const interviewRouter = require("../routes/interview.route");

// Middlewares

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set(path.join(__dirname, "views"));

// /* ======================= SESSION ======================= */
// app.use(
//     session({
//         secret: "secret-key",
//         resave: false,
//         saveUninitialized: false
//     })
// );

/* ======================= FOLDERS ======================= */
const uploadDir = path.join(process.cwd(), "upload");
const reportDir = path.join(uploadDir, "report");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

//Routes

app.get("/root", (req, res) => {
  res.send("Hi I am root");
});
app.use(cors());

module.exports = app;
