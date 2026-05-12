const PDFDocument = require("pdfkit");
const fs = require("fs");

/* ================= COLORS ================= */

const COLORS = {
  background: "#050505",

  card: "#0d0d0d",

  card2: "#101010",

  accent: "#00F7FF",

  accentGlow: "#7DF9FF",

  secondary: "#7C3AED",

  border: "#1d1d1d",

  text: "#FFFFFF",

  textSecondary: "#9CA3AF",

  success: "#22C55E",

  danger: "#FF4B4B",
};

/* ================= HELPERS ================= */

function safeText(value) {
  return value ? String(value) : "N/A";
}

function toArray(value) {
  if (!value) return [];

  return Array.isArray(value) ? value : [value];
}

function drawCard(doc, x, y, w, h) {
  doc
    .save()

    .roundedRect(x, y, w, h, 18)

    .fillAndStroke(COLORS.card, COLORS.border)

    .restore();
}

function drawMiniCard(doc, x, y, title, value, subtitle) {
  doc
    .roundedRect(x, y, 150, 100, 18)
    .fillAndStroke(COLORS.card2, COLORS.border);

  doc
    .fillColor(COLORS.textSecondary)
    .fontSize(11)
    .font("Helvetica")
    .text(title, x + 16, y + 16);

  doc
    .fillColor(COLORS.text)
    .fontSize(30)
    .font("Helvetica-Bold")
    .text(value, x + 16, y + 38);

  doc
    .fillColor(COLORS.success)
    .fontSize(10)
    .font("Helvetica")
    .text(subtitle, x + 16, y + 78);
}

function generatePDF(reportPath, outputPath, confidenceScore) {
  return new Promise((resolve, reject) => {
    try {
      const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

      const doc = new PDFDocument({
        margin: 0,
        size: "A4",
      });

      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      /* ================= PAGE BG ================= */

      function drawPageBackground() {
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.background);

        /* TOP GLOW */

        doc.opacity(0.08).circle(500, 80, 140).fill(COLORS.accent);

        doc.opacity(1);
      }

      drawPageBackground();

      /* ================= HEADER ================= */

      doc
        .fillColor(COLORS.text)
        .fontSize(34)
        .font("Helvetica-Bold")
        .text("InterVexa Report", 50, 45);

      doc
        .fillColor(COLORS.textSecondary)
        .fontSize(13)
        .font("Helvetica")
        .text("AI Powered Interview Analysis Dashboard", 50, 85);

      /* ================= ACCENT LINE ================= */

      doc
        .moveTo(50, 118)
        .lineTo(545, 118)
        .strokeColor(COLORS.accent)
        .lineWidth(2)
        .stroke();

      /* ================= STATS ================= */

      let avg = 0;

      if (report.answers?.length) {
        const total = report.answers.reduce(
          (acc, item) => acc + (item.feedback?.score || 0),
          0,
        );

        avg = Math.round(total / report.answers.length);
      }

      drawMiniCard(
        doc,
        50,
        145,
        "Confidence",
        `${confidenceScore || 0}%`,
        "Excellent",
      );

      drawMiniCard(
        doc,
        220,
        145,
        "Questions",
        `${report.answers?.length || 0}`,
        "Answered",
      );

      drawMiniCard(doc, 390, 145, "Average", `${avg}%`, "Performance");

      /* ================= SECTION TITLE ================= */

      doc
        .fillColor(COLORS.text)
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("Interview Breakdown", 50, 285);

      let currentY = 330;

      /* ================= QUESTIONS ================= */

      (report.answers || []).forEach((item, index) => {
        const question = report.questions?.[index]?.question || "No Question";

        const answer = item.finalAnswer || item.answer || "No Answer";

        const feedback = item.feedback || {};

        const questionHeight = doc.heightOfString(question, {
          width: 410,
        });

        const answerHeight = doc.heightOfString(answer, {
          width: 410,
        });

        const cardHeight = 340 + questionHeight + Math.min(answerHeight, 160);

        /* PAGE BREAK */

        if (currentY + cardHeight > 760) {
          doc.addPage();

          drawPageBackground();

          currentY = 50;
        }

        /* CARD */

        drawCard(doc, 50, currentY, 495, cardHeight);

        /* QUESTION TITLE */

        doc
          .fillColor(COLORS.accent)
          .fontSize(20)
          .font("Helvetica-Bold")
          .text(`Question ${index + 1}`, 75, currentY + 25);

        /* SCORE BADGE */

        doc.roundedRect(425, currentY + 22, 90, 35, 12).fill(COLORS.secondary);

        doc
          .fillColor("#ffffff")
          .fontSize(14)
          .font("Helvetica-Bold")
          .text(`${feedback.score || 0}%`, 455, currentY + 33);

        /* QUESTION LABEL */

        doc
          .fillColor(COLORS.text)
          .fontSize(13)
          .font("Helvetica-Bold")
          .text("Question", 75, currentY + 75);

        /* QUESTION TEXT */

        doc
          .fillColor(COLORS.textSecondary)
          .fontSize(11)
          .font("Helvetica")
          .text(safeText(question), 75, currentY + 98, {
            width: 410,
            lineGap: 4,
          });

        /* ANSWER */

        const answerY = currentY + 120 + questionHeight;

        doc
          .fillColor(COLORS.text)
          .fontSize(13)
          .font("Helvetica-Bold")
          .text("Answer", 75, answerY);

        doc
          .fillColor(COLORS.textSecondary)
          .fontSize(11)
          .font("Helvetica")
          .text(safeText(answer), 75, answerY + 24, {
            width: 410,
            lineGap: 4,
          });

        /* FEEDBACK BOXES */

        /* ================= ANSWER TEXT ================= */

        const answerTextY = answerY + 24;

        doc
          .fillColor(COLORS.textSecondary)
          .fontSize(11)
          .font("Helvetica")
          .text(safeText(answer), 75, answerTextY, {
            width: 410,
            lineGap: 4,
          });

        /* ================= GET ACTUAL ANSWER HEIGHT ================= */

        const renderedAnswerHeight = doc.heightOfString(safeText(answer), {
          width: 410,
          lineGap: 4,
        });

        /* ================= FEEDBACK POSITION ================= */

        const feedbackY = answerTextY + renderedAnswerHeight + 30;

        /* STRENGTH CARD */

        doc
          .roundedRect(75, feedbackY, 190, 90, 14)
          .fillAndStroke("#0f1411", "#1d3b27");

        doc
          .fillColor(COLORS.success)
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("Strengths", 92, feedbackY + 15);

        const strengths = toArray(feedback.strengths);

        strengths.slice(0, 2).forEach((s, i) => {
          doc
            .fillColor(COLORS.textSecondary)
            .fontSize(10)
            .font("Helvetica")
            .text(`• ${safeText(s)}`, 92, feedbackY + 38 + i * 16, {
              width: 150,
            });
        });

        /* IMPROVEMENT CARD */

        doc
          .roundedRect(295, feedbackY, 190, 90, 14)
          .fillAndStroke("#161010", "#4a1f1f");

        doc
          .fillColor(COLORS.danger)
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("Improvements", 312, feedbackY + 15);

        const improvements = toArray(feedback.improvements);

        improvements.slice(0, 2).forEach((s, i) => {
          doc
            .fillColor(COLORS.textSecondary)
            .fontSize(10)
            .font("Helvetica")
            .text(`• ${safeText(s)}`, 312, feedbackY + 38 + i * 16, {
              width: 150,
            });
        });

        currentY += cardHeight + 28;
      });

      /* ================= FOOTER ================= */

      doc
        .fillColor(COLORS.textSecondary)
        .fontSize(10)
        .font("Helvetica")
        .text("Generated by InterVexa AI", 0, doc.page.height - 35, {
          align: "center",
        });

      /* ================= FINISH ================= */

      doc.end();

      stream.on("finish", () => {
        console.log("✅ PDF Generated Successfully");

        resolve();
      });

      stream.on("error", (err) => {
        console.log("❌ PDF Stream Error:", err);

        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = generatePDF;
