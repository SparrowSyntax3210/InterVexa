const express = require('express');
const app = express();
const path = require("path")

module.exports = app;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
app.use(express.urlencoded({ extended: true }));

app.get("/root" ,(req,res)=>{
    res.send("Hi I am root");
});