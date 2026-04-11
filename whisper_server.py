from flask import Flask, request, jsonify
import whisper
import os
import json
from datetime import datetime

# Add FFmpeg path
os.environ["PATH"] += os.pathsep + r"C:\ffmpeg\bin"

app = Flask(__name__)

model = whisper.load_model("base")


@app.route("/")
def home():
    return "Whisper Server Running"


@app.route("/transcribe", methods=["POST"])
def transcribe():

    if 'audio' not in request.files:
        return jsonify({"error": "No audio"}), 400

    file = request.files['audio']

    filepath = "audio.webm"
    wavpath = "audio.wav"

    # Remove old files
    if os.path.exists(filepath):
        os.remove(filepath)

    if os.path.exists(wavpath):
        os.remove(wavpath)

    # Save new file
    file.save(filepath)

    # Convert audio
    os.system(f'ffmpeg -y -i {filepath} -ar 16000 -ac 1 {wavpath}')

    # Transcribe
    result = model.transcribe(wavpath)
    text = result["text"]

    print("Transcript:", text)


    # ===== Save Answer to Same Report =====

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

                # increment safely
                report["currentQuestion"] = current_index + 1

                with open(report_path, "w") as f:
                    json.dump(report, f, indent=4)

                print("Answer saved:", current_question["question"])

    return jsonify({"text": text})


app.run(host="0.0.0.0", port=5000, debug=True)