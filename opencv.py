import mediapipe as mp
import cv2
import time
import math
from flask import Flask, jsonify, Response
import whisper
import os
from flask_cors import CORS

# FFmpeg Path
os.environ["PATH"] += os.pathsep + r"C:\ffmpeg\bin"

app = Flask(__name__)
CORS(app)

# Load Whisper Model
model = whisper.load_model("base")

# -------------------------------
# MediaPipe Setup
# -------------------------------

BaseOptions = mp.tasks.BaseOptions
FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

MODEL_PATH = "public/models/face_landmarker.task"

options = FaceLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=MODEL_PATH),
    running_mode=VisionRunningMode.VIDEO,
    output_face_blendshapes=True,
    output_facial_transformation_matrixes=True
)

detector = FaceLandmarker.create_from_options(options)

# -------------------------------
# Settings
# -------------------------------

H_GAZE_SENSITIVITY = 0.07
V_GAZE_SENSITIVITY = 0.12
YAW_THRESHOLD = 15
PITCH_THRESHOLD = 15

confidence_score = 0
is_tracking = False

# -------------------------------
# Video Generator
# -------------------------------

def generate_frames():
    global confidence_score, is_tracking

    cap = cv2.VideoCapture(0)

    focused_frames = 0
    total_frames = 0
    confidence_score = 0
    is_tracking = True

    print("InterVexa Started...")

    while is_tracking:

        success, frame = cap.read()
        if not success:
            break

        frame = cv2.flip(frame, 1)

        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=frame
        )

        timestamp = int(time.time() * 1000)

        result = detector.detect_for_video(mp_image, timestamp)

        if result.face_landmarks and result.facial_transformation_matrixes:

            total_frames += 1

            landmarks = result.face_landmarks[0]
            matrix = result.facial_transformation_matrixes[0]

            yaw = math.atan2(matrix[0][2], matrix[2][2]) * (180 / math.pi)
            pitch = math.asin(-matrix[1][2]) * (180 / math.pi)

            l_left = landmarks[33]
            l_right = landmarks[133]
            l_pupil = landmarks[468]

            r_right = landmarks[362]
            r_left = landmarks[263]
            r_pupil = landmarks[473]

            h_ratio = (
                (l_pupil.x - l_left.x) / (l_right.x - l_left.x)
                +
                (r_pupil.x - r_right.x) / (r_left.x - r_right.x)
            ) / 2

            l_top = landmarks[159]
            l_bottom = landmarks[145]

            v_ratio = (l_pupil.y - l_top.y) / (l_bottom.y - l_top.y)

            head_focused = abs(yaw) < YAW_THRESHOLD and abs(pitch) < PITCH_THRESHOLD

            gaze_focused = (
                (0.5 - H_GAZE_SENSITIVITY) < h_ratio < (0.5 + H_GAZE_SENSITIVITY)
                and
                (0.5 - V_GAZE_SENSITIVITY) < v_ratio < (0.5 + V_GAZE_SENSITIVITY)
            )

            if head_focused and gaze_focused:
                focused_frames += 1
                status = "FULLY FOCUSED"
                color = (0, 255, 0)

            elif not head_focused:
                status = "HEAD TURNED"
                color = (0, 0, 255)

            else:
                status = "EYES WANDERING"
                color = (0, 165, 255)

            # ✅ REAL-TIME CONFIDENCE UPDATE (FIX)
            if total_frames > 0:
                confidence_score = (focused_frames / total_frames) * 100

            cv2.putText(
                frame,
                status,
                (30, 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                color,
                2
            )

        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()

        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' +
            frame +
            b'\r\n'
        )

    cap.release()

    print("Final Confidence Score:", confidence_score)

# -------------------------------
# Start Video
# -------------------------------

@app.route("/video")
def video_feed():
    return Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )

# -------------------------------
# Stop Video
# -------------------------------

@app.route("/stop-video", methods=["POST"])
def stop_video():
    global is_tracking
    is_tracking = False

    return jsonify({
        "message": "Video stopped"
    })

# -------------------------------
# Confidence API
# -------------------------------

@app.route("/confidence")
def get_score():
    return jsonify({
        "confidence_score": confidence_score
    })

@app.route("/stop", methods=["POST"])
def stop():
    global is_tracking
    is_tracking = False
    cv2.destroyAllWindows()

    return jsonify({"message": "stopped"})
# -------------------------------
# Run Server
# -------------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)