let socket;
const log = document.getElementById("log");

function connect() {
    socket = new WebSocket("ws://localhost:3000");

    socket.onopen = () => {
        log.innerHTML = "Connected to AETHERIS backend";
    };

    socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "INIT") {
            console.log(msg.message);
        }

        if (msg.type === "AI_RESPONSE") {
            log.innerHTML += "<br>AI: " + msg.text;
        }
    };
}

function askAI(text) {
    socket.send(JSON.stringify({
        type: "AI_QUERY",
        message: text
    }));
}

// auto start
connect();

// test calls
setTimeout(() => askAI("sun"), 2000);
setTimeout(() => askAI("black hole"), 4000);
