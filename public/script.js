const socket = io();

let myUsername = "";
let selectedUser = null;


// Join Chat

function joinChat() {

    const usernameInput = document.getElementById("username");

    const username = usernameInput.value.trim();

    if (username === "") {

        alert("Please enter your name");

        return;
    }

    myUsername = username;

    socket.emit("join", username);

    document.getElementById("login").style.display = "none";

    document.getElementById("chat").style.display = "flex";
}


// Receive users

socket.on("users", (users) => {

    const usersList = document.getElementById("users");

    usersList.innerHTML = "";

    users.forEach((user) => {

        // Don't show yourself
        if (user.name === myUsername) {
            return;
        }

        const li = document.createElement("li");

        li.textContent = user.name;

        li.onclick = () => {

            selectedUser = user;

            document.getElementById("chatWith").textContent =
                "Chat with " + user.name;

            document.getElementById("messages").innerHTML = "";

        };

        usersList.appendChild(li);

    });

});


// Send message

const form = document.getElementById("form");

form.addEventListener("submit", (e) => {

    e.preventDefault();

    const input = document.getElementById("input");

    const message = input.value.trim();

    if (message === "") {
        return;
    }

    if (selectedUser === null) {

        alert("Select a user first");

        return;
    }


    // Send private message

    socket.emit("private message", {

        to: selectedUser.id,

        message: message

    });


    // Display message on our screen

    addMessage("You: " + message);

    input.value = "";

});


// Receive private message

socket.on("private message", (data) => {

    addMessage(data.from + ": " + data.message);

});


// Add message to screen

function addMessage(message) {

    const messages = document.getElementById("messages");

    const li = document.createElement("li");

    li.textContent = message;

    messages.appendChild(li);

    messages.scrollTop = messages.scrollHeight;

}