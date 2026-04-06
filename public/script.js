const button = document.querySelector("#speak")

button.addEventListener("click", async function whisper() {

    const formData = new FormData()
    formData.append("audio", audioBlob)

    const response = await fetch("http://localhost:4000/transcribe", {
        method: "POST",
        body: formData
    })

    const data = await response.json()

    console.log("Whisper Output:", data)
    console.log("Text:", data.text)

})