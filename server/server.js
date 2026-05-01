import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// serve frontend
app.use(express.static("public"));

wss.on("connection", (ws) => {
    console.log("Client connected");

    ws.send(JSON.stringify({
        type: "INIT",
        message: "AETHERIS backend online"
    }));

    ws.on("message", (msg) => {
        const data = JSON.parse(msg.toString());

        // 🧠 AI logic (simple backend brain)
        if (data.type === "AI_QUERY") {
            let reply = "Unknown signal.";

            if (data.message.includes("sun")) {
                reply = "The sun is a G-type main-sequence star.";
            }

            if (data.message.includes("black hole")) {
                reply = "Warning: spacetime singularity detected.";
            }

            ws.send(JSON.stringify({
                type: "AI_RESPONSE",
                text: reply
            }));
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected");
    });
});

server.listen(3000, () => {
    console.log("AETHERIS running on http://localhost:3000");
});
