from flask import Flask, request, jsonify
import whisper
import os

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

    file.save(filepath)

    print("File saved:", filepath)
    print("File size:", os.path.getsize(filepath))

    # Convert audio
    os.system(f'ffmpeg -i {filepath} -ar 16000 -ac 1 {wavpath}')

    # Transcribe
    result = model.transcribe(wavpath)

    print("Whisper Result:", result)
    print("Text:", result["text"])

    return jsonify({"text": result["text"]})

app.run(host="0.0.0.0", port=5000, debug=True)