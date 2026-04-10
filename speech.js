let mediaRecorder;
let audioChunks = [];

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };

  mediaRecorder.onstop = sendToWhisper;

  mediaRecorder.start();

  console.log("Recording started...");
}

function stopRecording() {
  mediaRecorder.stop();
  console.log("Recording stopped...");
}
