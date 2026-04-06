const express = require('express');
const app = express();
const path = require("path")
const multer = require("multer")
const axios = require("axios")
const FormData = require("form-data")
const fs = require("fs")
const cors = require("cors")



// Middlewares

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.urlencoded({ extended: true }));

app.set("view engine" , "ejs")
app.set(path.join(__dirname, "views"));

//Routes

app.get("/root" ,(req,res)=>{
    res.send("Hi I am root");
});
app.use(cors())

const upload = multer({ dest: "uploads/" })

app.post("/transcribe", upload.single("audio"), async (req, res) => {

    try {

        const formData = new FormData()
        formData.append("audio", fs.createReadStream(req.file.path))

        const response = await axios.post(
            "http://localhost:5000/transcribe",
            formData,
            {
                headers: formData.getHeaders()
            }
        )

        res.json(response.data)

    } catch (error) {
        console.error(error)
        res.status(500).send("Error transcribing audio")
    }

})
module.exports = app;