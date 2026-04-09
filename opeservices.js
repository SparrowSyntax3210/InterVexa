const axios = require("axios");

export const askai = async (messages) => {
    try {
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            throw
        }
    }}