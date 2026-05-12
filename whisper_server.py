from flask import Flask, request, jsonify
from flask_cors import CORS   # ✅ CORS FIX
import whisper
import os
import json
from datetime import datetime
import subprocess   

# Add FFmpeg path
os.environ["PATH"] += os.pathsep + r"C:\ffmpeg\bin"

app = Flask(__name__)
CORS(app, origins=["http://localhost:4000"])

print("Loading Whisper model...")
model = whisper.load_model("base")
print("Whisper model loaded")
is_transcribing = False


@app.route("/")
def home():
    return "Whisper Server Running"
@app.route("/stop", methods=["POST"])
def stop():
    global is_transcribing
    is_transcribing = False

    return jsonify({
        "message": "whisper stopped"
    })


@app.route("/transcribe", methods=["POST"])
def transcribe():
    global is_transcribing

    try:
        is_transcribing = True
        print("Request received")

        if "audio" not in request.files:
            is_transcribing = False
            return jsonify({"error": "No audio"}), 400

        file = request.files["audio"]

        timestamp = str(int(datetime.now().timestamp()))
        filepath = f"audio_{timestamp}.webm"
        wavpath = f"audio_{timestamp}.wav"

        file.save(filepath)

        command = [
            "ffmpeg", "-y",
            "-i", filepath,
            "-ar", "16000",
            "-ac", "1",
            wavpath
        ]

        result = subprocess.run(command, capture_output=True, text=True)

        if result.returncode != 0:
            is_transcribing = False
            return jsonify({"error": "Audio conversion failed"}), 500

        result = model.transcribe(wavpath)
        text = result.get("text", "")

        if os.path.exists(filepath):
            os.remove(filepath)

        if os.path.exists(wavpath):
            os.remove(wavpath)

        is_transcribing = False

        return jsonify({"text": text})

    except Exception as e:
        is_transcribing = False
        print("SERVER ERROR:", str(e))
        return jsonify({"error": "Internal server error"}), 500
        


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)