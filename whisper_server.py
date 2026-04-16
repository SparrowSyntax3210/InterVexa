from flask import Flask, request, jsonify
from flask_cors import CORS   # ✅ CORS FIX
import whisper
import os
import json
from datetime import datetime
import subprocess   # ✅ better than os.system

# Add FFmpeg path
os.environ["PATH"] += os.pathsep + r"C:\ffmpeg\bin"

app = Flask(__name__)

# ✅ Allow your frontend (change if needed)
CORS(app, origins=["http://localhost:4000"])

print("⏳ Loading Whisper model...")
model = whisper.load_model("base")
print("✅ Whisper model loaded")


@app.route("/")
def home():
    return "Whisper Server Running"


@app.route("/transcribe", methods=["POST"])
def transcribe():
    try:
        print("\n🔥 Request received")
        print("FILES:", request.files)

        # ✅ Check audio exists
        if 'audio' not in request.files:
            print("❌ No audio in request")
            return jsonify({"error": "No audio"}), 400

        file = request.files['audio']
        print("✅ Audio received:", file.filename)

        # ✅ Unique filenames (avoid overwrite bugs)
        timestamp = str(int(datetime.now().timestamp()))
        filepath = f"audio_{timestamp}.webm"
        wavpath = f"audio_{timestamp}.wav"

        # Save file
        file.save(filepath)
        print("💾 Saved:", filepath)

        # ✅ Convert using subprocess (better debugging)
        command = [
            "ffmpeg", "-y",
            "-i", filepath,
            "-ar", "16000",
            "-ac", "1",
            wavpath
        ]

        result = subprocess.run(command, capture_output=True, text=True)

        if result.returncode != 0:
            print("❌ FFmpeg Error:", result.stderr)
            return jsonify({"error": "Audio conversion failed"}), 500

        print("🎧 Converted to WAV:", wavpath)

        # ✅ Transcribe
        result = model.transcribe(wavpath)
        text = result.get("text", "")

        print("📝 Transcript:", text)

        # ===== Save Answer to Report =====
        report_dir = os.path.join(os.getcwd(), "reports")

        if os.path.exists(report_dir):
            files = os.listdir(report_dir)

            if files:
                latest_file = max(
                    files,
                    key=lambda f: os.path.getmtime(
                        os.path.join(report_dir, f)
                    )
                )

                report_path = os.path.join(report_dir, latest_file)

                with open(report_path, "r") as f:
                    report = json.load(f)

                current_index = report.get("currentQuestion", 0)

                if current_index < len(report.get("questions", [])):
                    current_question = report["questions"][current_index]

                    if "answers" not in report:
                        report["answers"] = []

                    report["answers"].append({
                        "question": current_question["question"],
                        "answer": text,
                        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    })

                    report["currentQuestion"] = current_index + 1

                    with open(report_path, "w") as f:
                        json.dump(report, f, indent=4)

                    print("📊 Answer saved:", current_question["question"])

        # ✅ Cleanup (optional but good)
        if os.path.exists(filepath):
            os.remove(filepath)
        if os.path.exists(wavpath):
            os.remove(wavpath)

        return jsonify({"text": text})

    except Exception as e:
        print("🔥 SERVER ERROR:", str(e))
        return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)