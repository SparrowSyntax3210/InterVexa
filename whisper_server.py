from flask import Flask, request, jsonify
import whisper
import os

# Add FFmpeg path
os.environ["PATH"] += os.pathsep + r"C:\ffmpeg\bin"

app = Flask(__name__)

model = whisper.load_model("base")

@app.route("/transcribe", methods=["POST"])
def transcribe():

    if 'audio' not in request.files:
        return jsonify({"error": "No audio"}), 400

    file = request.files['audio']

    # Save file
    filepath = "audio.webm"   # <-- change from wav to webm
    file.save(filepath)

    # Debug info
    print("File saved:", filepath)
    print("File size:", os.path.getsize(filepath))

    # Transcribe
    result = model.transcribe(filepath)

    print("Whisper Result:", result)
    print("Text:", result["text"])

    return jsonify({"text": result["text"]})

app.run(host="0.0.0.0", port=5000, debug=True)