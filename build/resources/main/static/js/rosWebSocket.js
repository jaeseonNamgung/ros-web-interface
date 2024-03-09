let stompClient = null;
export let message = null;
function connect() {
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function () {
        stompClient.subscribe("/topic/robot", function (greeting) {
            message = greeting.body;
        });
    });
}


function sendMove(direction) {
    stompClient.send("/app/moveRobot", {}, direction);
}

document.addEventListener('keydown', function (event) {
    switch (event.key) {
        case "ArrowUp":
            sendMove("forward");
            break;
        case "ArrowDown":
            sendMove("backward");
            break;
        case "ArrowLeft":
            sendMove("left");
            break;
        case "ArrowRight":
            sendMove("right");
            break;
    }
});
connect();