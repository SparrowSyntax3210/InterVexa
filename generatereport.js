const PDFDocument = require("pdfkit");
const fs = require("fs");

// ================= COLORS =================
const COLORS = {
  background: "#000000",
  card: "#0a0a0a",
  glass: "#111111",

  accent: "#00FFFF",
  accentSoft: "#7ffcff",

  secondary: "#7c3aed",

  border: "#123838",

  text: "#ffffff",
  textSecondary: "#b5b5b5",

  success: "#22c55e",
  danger: "#ff4b4b",
};

// ================= HELPERS =================
function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function safeText(value) {
  return value ? String(value) : "N/A";
}

function drawCard(doc, x, y, w, h) {
  doc.roundedRect(x, y, w, h, 14).fillAndStroke(COLORS.card, COLORS.border);
}

function statCard(doc, x, y, title, value, subtitle) {
  drawCard(doc, x, y, 150, 90);

  doc
    .fillColor(COLORS.textSecondary)
    .fontSize(11)
    .font("Helvetica")
    .text(title, x + 15, y + 15);

  doc
    .fillColor(COLORS.text)
    .fontSize(24)
    .font("Helvetica-Bold")
    .text(value, x + 15, y + 35);

  doc
    .fillColor(COLORS.success)
    .fontSize(10)
    .font("Helvetica")
    .text(subtitle, x + 15, y + 68);
}

// ================= MAIN FUNCTION =================
function generatePDF(reportPath, outputPath, confidenceScore) {
  return new Promise((resolve, reject) => {
    try {
      // ================= READ REPORT =================
      const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

      // ================= CREATE DOC =================
      const doc = new PDFDocument({
        margin: 0,
        size: "A4",
      });

      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // ================= BACKGROUND =================
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.background);

      // ================= HEADER =================
      doc
        .fillColor(COLORS.text)
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("Intervexa Report", 50, 40);

      doc
        .fillColor(COLORS.textSecondary)
        .fontSize(11)
        .font("Helvetica")
        .text("AI Powered Interview Analysis", 50, 70);

      // Accent line
      doc
        .moveTo(50, 95)
        .lineTo(545, 95)
        .strokeColor(COLORS.accent)
        .lineWidth(1.5)
        .stroke();

      // ================= STATS =================
      statCard(
        doc,
        50,
        120,
        "Confidence Score",
        `${confidenceScore || 0}%`,
        "Excellent",
      );

      statCard(
        doc,
        220,
        120,
        "Questions",
        `${(report.answers || []).length}`,
        "Answered",
      );

      // ================= AVG SCORE =================
      let avg = 0;

      if (report.answers?.length) {
        const total = report.answers.reduce((acc, item) => {
          return acc + (item.feedback?.score || 0);
        }, 0);

        avg = Math.round(total / report.answers.length);
      }

      statCard(doc, 390, 120, "Average Score", `${avg}%`, "Performance");

      // ================= SECTION TITLE =================
      doc
        .fillColor(COLORS.text)
        .fontSize(18)
        .font("Helvetica-Bold")
        .text("Interview Breakdown", 50, 250);

      let currentY = 290;

      // ================= ANSWERS =================
      (report.answers || []).forEach((item, index) => {
        // New Page
        if (currentY > 650) {
          doc.addPage();

          doc
            .rect(0, 0, doc.page.width, doc.page.height)
            .fill(COLORS.background);

          currentY = 50;
        }

        const cardHeight = 190;

        // Card
        drawCard(doc, 50, currentY, 495, cardHeight);

        // ================= QUESTION =================
        doc
          .fillColor(COLORS.accent)
          .fontSize(14)
          .font("Helvetica-Bold")
          .text(`Question ${index + 1}`, 70, currentY + 20);

        doc
          .fillColor(COLORS.text)
          .fontSize(12)
          .font("Helvetica")
          .text(safeText(item.question), 70, currentY + 45, {
            width: 430,
          });

        // ================= ANSWER =================
        doc
          .fillColor(COLORS.textSecondary)
          .fontSize(11)
          .font("Helvetica-Bold")
          .text("Answer", 70, currentY + 85);

        doc
          .fillColor(COLORS.text)
          .fontSize(10)
          .font("Helvetica")
          .text(safeText(item.answer), 70, currentY + 105, {
            width: 430,
            height: 40,
          });

        // ================= SCORE BADGE =================
        doc.roundedRect(430, currentY + 18, 85, 30, 10).fill(COLORS.secondary);

        doc
          .fillColor("#ffffff")
          .fontSize(12)
          .font("Helvetica-Bold")
          .text(`${item.feedback?.score || 0}%`, 455, currentY + 27);

        // ================= STRENGTHS =================
        const strengths = toArray(item.feedback?.strengths);

        doc
          .fillColor(COLORS.success)
          .fontSize(11)
          .font("Helvetica-Bold")
          .text("Strengths", 70, currentY + 150);

        strengths.slice(0, 2).forEach((s, i) => {
          doc
            .fillColor(COLORS.textSecondary)
            .fontSize(10)
            .font("Helvetica")
            .text(`• ${safeText(s)}`, 140, currentY + 150 + i * 14);
        });

        // ================= IMPROVEMENTS =================
        const improvements = toArray(item.feedback?.improvements);

        doc
          .fillColor(COLORS.danger)
          .fontSize(11)
          .font("Helvetica-Bold")
          .text("Improvements", 300, currentY + 150);

        improvements.slice(0, 2).forEach((s, i) => {
          doc
            .fillColor(COLORS.textSecondary)
            .fontSize(10)
            .font("Helvetica")
            .text(`• ${safeText(s)}`, 410, currentY + 150 + i * 14);
        });

        currentY += cardHeight + 20;
      });

      // ================= FOOTER =================
      doc
        .fillColor(COLORS.textSecondary)
        .fontSize(10)
        .font("Helvetica")
        .text("Generated by Intervexa AI", 0, doc.page.height - 40, {
          align: "center",
        });

      // ================= FINISH =================
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
