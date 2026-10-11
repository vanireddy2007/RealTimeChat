const token = localStorage.getItem("token");
const currentUser = JSON.parse(localStorage.getItem("user"));

if (!token || !currentUser) {
    window.location.href = "index.html";
}

document.getElementById("myName").textContent =
    currentUser.name;

const socket = io({
    auth: {
        token: token
    }
});

let users = [];
let selectedUser = null;
let onlineUserIds = [];

const usersList =
    document.getElementById("usersList");

const messagesContainer =
    document.getElementById("messagesContainer");

const messageInput =
    document.getElementById("messageInput");

const sendBtn =
    document.getElementById("sendBtn");

const chatUserName =
    document.getElementById("chatUserName");

const onlineStatus =
    document.getElementById("onlineStatus");

const typingIndicator =
    document.getElementById("typingIndicator");

const searchInput =
    document.getElementById("searchInput");

const logoutBtn =
    document.getElementById("logoutBtn");


/* =========================
   LOAD USERS
========================= */

async function loadUsers() {

    try {

        const response =
            await fetch("/api/users", {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            });

        if (
            response.status === 401 ||
            response.status === 403
        ) {
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error(
                "Failed to load users"
            );
        }

        users =
            await response.json();

        displayUsers(users);

    } catch (error) {

        console.log(
            "Failed to load users:",
            error
        );

        usersList.innerHTML = `
            <p class="loading">
                Failed to load users
            </p>
        `;
    }
}


/* =========================
   DISPLAY USERS
========================= */

function displayUsers(userArray) {

    usersList.innerHTML = "";

    if (userArray.length === 0) {

        usersList.innerHTML = `
            <p class="loading">
                No other users registered.
            </p>
        `;

        return;
    }

    userArray.forEach(user => {

        const div =
            document.createElement("div");

        div.className =
            "user-item";

        if (
            selectedUser &&
            Number(selectedUser.user_id) ===
            Number(user.user_id)
        ) {
            div.classList.add("active");
        }

        const firstLetter =
            user.name
                .charAt(0)
                .toUpperCase();

        const unreadCount =
            Number(user.unread_count || 0);

        div.innerHTML = `
            <div class="user-avatar">
                ${escapeHTML(firstLetter)}
            </div>

            <div class="user-info">

                <div class="user-name">
                    ${escapeHTML(user.name)}
                </div>

                <div class="last-message">
                    ${
                        user.last_message
                            ? escapeHTML(
                                user.last_message
                            )
                            : "Start a conversation"
                    }
                </div>

            </div>

            ${
                unreadCount > 0
                    ? `
                        <div class="unread-count">
                            ${unreadCount}
                        </div>
                    `
                    : ""
            }
        `;

        div.addEventListener(
            "click",
            () => selectUser(user)
        );

        usersList.appendChild(div);

    });
}


/* =========================
   SELECT USER
========================= */

async function selectUser(user) {

    selectedUser = user;

    chatUserName.textContent =
        user.name;

    updateOnlineStatus();

    displayUsers(users);

    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <h2>Loading chat...</h2>
        </div>
    `;

    typingIndicator.textContent =
        "";

    await loadMessages(
        user.user_id
    );

    await markMessagesAsRead(
        user.user_id
    );

    socket.emit(
        "messages_read",
        user.user_id
    );

    user.unread_count = 0;

    displayUsers(users);

    messageInput.focus();
}


/* =========================
   LOAD MESSAGES
========================= */

async function loadMessages(userId) {

    try {

        const response =
            await fetch(
                `/api/messages/${userId}`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

        if (!response.ok) {

            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <h2>
                        Unable to load messages
                    </h2>
                </div>
            `;

            return;
        }

        const messages =
            await response.json();

        messagesContainer.innerHTML =
            "";

        if (messages.length === 0) {

            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <h2>Start chatting</h2>
                    <p>
                        Send your first message.
                    </p>
                </div>
            `;

            return;
        }

        messages.forEach(
            message => {
                displayMessage(message);
            }
        );

        scrollToBottom();

    } catch (error) {

        console.log(
            "Message loading error:",
            error
        );

        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <h2>Something went wrong</h2>
            </div>
        `;
    }
}


/* =========================
   DISPLAY MESSAGE
========================= */

function displayMessage(message) {

    const div =
        document.createElement("div");

    const senderId =
        message.sender_id !== undefined
            ? message.sender_id
            : message.senderId;

    const isSent =
        Number(senderId) ===
        Number(currentUser.userId);

    div.className =
        isSent
            ? "message sent"
            : "message received";


    /* MESSAGE ID */

    const messageId =
        message.message_id !== undefined
            ? message.message_id
            : message.messageId;

    if (messageId !== undefined) {

        div.dataset.messageId =
            messageId;
    }


    /* DELETED FOR EVERYONE */

    const isDeleted =
        message.deleted_for_everyone === true ||
        message.deleted_for_everyone === 1 ||
        message.deletedForEveryone === true;


    if (isDeleted) {

        div.classList.add(
            "deleted-message"
        );

        div.innerHTML = `
            <span class="deleted-text">
                This message was deleted
            </span>
        `;

        return;
    }


    /* MESSAGE TEXT */

    const messageText =
        message.message;


    /* TIME */

    const sentTime =
        message.sent_at !== undefined
            ? message.sent_at
            : message.sentAt;

    const date =
        new Date(sentTime);

    const time =
        date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );


    /* MESSAGE STATUS */

    let status = "";

    if (isSent) {

        const isRead =
            message.is_read === true ||
            message.is_read === 1;

        const isDelivered =
            message.is_delivered === true ||
            message.is_delivered === 1 ||
            message.isDelivered === true;

        if (isRead) {

            status = `
                <span
                    class="message-status read"
                >
                    ✓✓
                </span>
            `;

        } else if (isDelivered) {

            status = `
                <span
                    class="message-status delivered"
                >
                    ✓✓
                </span>
            `;

        } else {

            status = `
                <span
                    class="message-status"
                >
                    ✓
                </span>
            `;
        }
    }


    /* MESSAGE CONTENT */

    div.innerHTML = `
        <span class="message-text">
            ${escapeHTML(messageText)}
        </span>

        <span class="message-time">
            ${time}
        </span>

        ${status}
    `;


    /* =========================
       DELETE BUTTON
    ========================= */

    if (
        messageId !== undefined
    ) {

        const deleteButton =
            document.createElement("button");

        deleteButton.className =
            "delete-message-btn";

        deleteButton.textContent =
            "Delete";

        deleteButton.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                showDeleteMenu(
                    messageId,
                    isSent,
                    deleteButton
                );
            }
        );

        div.appendChild(
            deleteButton
        );
    }


    messagesContainer.appendChild(
        div
    );
}


/* =========================
   DELETE MENU
========================= */

function showDeleteMenu(
    messageId,
    isSent,
    button
) {

    /* Remove existing menus */

    document
        .querySelectorAll(
            ".delete-menu"
        )
        .forEach(menu => {
            menu.remove();
        });


    const menu =
        document.createElement("div");

    menu.className =
        "delete-menu";


    /* DELETE FOR ME */

    const deleteForMe =
        document.createElement("button");

    deleteForMe.textContent =
        "Delete for me";

    deleteForMe.addEventListener(
        "click",
        () => {

            socket.emit(
                "delete_message_for_me",
                {
                    messageId:
                        messageId
                }
            );

            menu.remove();
        }
    );


    menu.appendChild(
        deleteForMe
    );


    /* DELETE FOR EVERYONE */

    if (isSent) {

        const deleteForEveryone =
            document.createElement("button");

        deleteForEveryone.textContent =
            "Delete for everyone";

        deleteForEveryone.addEventListener(
            "click",
            () => {

                const confirmDelete =
                    confirm(
                        "Delete this message for everyone?"
                    );

                if (!confirmDelete) {
                    return;
                }

                socket.emit(
                    "delete_message",
                    {
                        messageId:
                            messageId
                    }
                );

                menu.remove();
            }
        );


        menu.appendChild(
            deleteForEveryone
        );
    }


    /* CANCEL */

    const cancelButton =
        document.createElement("button");

    cancelButton.textContent =
        "Cancel";

    cancelButton.addEventListener(
        "click",
        () => {
            menu.remove();
        }
    );


    menu.appendChild(
        cancelButton
    );


    /* Position menu */

    button.parentElement.appendChild(
        menu
    );
}


/* =========================
   MESSAGE DELETED
   FOR EVERYONE
========================= */

socket.on(
    "message_deleted",
    data => {

        console.log(
            "Message deleted:",
            data
        );

        const messageElement =
            document.querySelector(
                `[data-message-id="${data.messageId}"]`
            );

        if (!messageElement) {
            return;
        }

        messageElement.classList.add(
            "deleted-message"
        );

        messageElement.innerHTML = `
            <span class="deleted-text">
                This message was deleted
            </span>
        `;
    }
);


/* =========================
   MESSAGE DELETED
   FOR ME
========================= */

socket.on(
    "message_deleted_for_me",
    data => {

        console.log(
            "Message deleted for me:",
            data
        );

        const messageElement =
            document.querySelector(
                `[data-message-id="${data.messageId}"]`
            );

        if (!messageElement) {
            return;
        }

        messageElement.remove();
    }
);


/* =========================
   DELETE ERROR
========================= */

socket.on(
    "delete_message_error",
    data => {

        alert(
            data.message ||
            "Unable to delete message"
        );
    }
);


/* =========================
   SEND MESSAGE
========================= */

function sendMessage() {

    if (!selectedUser) {

        alert(
            "Select a user first."
        );

        return;
    }

    const message =
        messageInput.value.trim();

    if (!message) {
        return;
    }

    socket.emit(
        "private_message",
        {
            receiverId:
                selectedUser.user_id,

            message:
                message
        }
    );

    messageInput.value = "";

    messageInput.focus();
}


/* =========================
   MESSAGE SENT
========================= */

socket.on(
    "message_sent",
    message => {

        console.log(
            "Message sent:",
            message
        );

        if (!selectedUser) {
            return;
        }

        if (
            Number(message.receiverId) ===
            Number(selectedUser.user_id)
        ) {

            displayMessage({

                ...message,

                is_delivered:
                    message.isDelivered
                        ? 1
                        : 0,

                is_read:
                    message.isRead
                        ? 1
                        : 0
            });

            scrollToBottom();
        }

        loadUsers();
    }
);


/* =========================
   MESSAGE RECEIVED
========================= */

socket.on(
    "private_message",
    message => {

        console.log(
            "Message received:",
            message
        );

        if (!selectedUser) {

            loadUsers();

            return;
        }

        if (
            Number(message.senderId) ===
            Number(selectedUser.user_id)
        ) {

            displayMessage({

                ...message,

                is_delivered: 1
            });

            scrollToBottom();

            markMessagesAsRead(
                selectedUser.user_id
            );

            socket.emit(
                "messages_read",
                selectedUser.user_id
            );

            selectedUser.unread_count =
                0;

            displayUsers(users);

        } else {

            loadUsers();
        }
    }
);


/* =========================
   MESSAGE DELIVERED
========================= */

socket.on(
    "message_delivered",
    data => {

        console.log(
            "Message delivered:",
            data
        );

        const messageElement =
            document.querySelector(
                `[data-message-id="${data.messageId}"]`
            );

        if (!messageElement) {
            return;
        }

        const status =
            messageElement.querySelector(
                ".message-status"
            );

        if (!status) {
            return;
        }

        status.textContent =
            "✓✓";

        status.classList.add(
            "delivered"
        );
    }
);


/* =========================
   MESSAGES READ
========================= */

socket.on(
    "messages_read",
    data => {

        console.log(
            "Messages read by:",
            data.readerId
        );

        if (!selectedUser) {
            return;
        }

        if (
            Number(data.readerId) !==
            Number(selectedUser.user_id)
        ) {
            return;
        }

        const sentMessages =
            messagesContainer.querySelectorAll(
                ".message.sent"
            );

        sentMessages.forEach(
            messageElement => {

                const status =
                    messageElement.querySelector(
                        ".message-status"
                    );

                if (!status) {
                    return;
                }

                status.textContent =
                    "✓✓";

                status.classList.remove(
                    "delivered"
                );

                status.classList.add(
                    "read"
                );
            }
        );
    }
);


/* =========================
   ONLINE USERS
========================= */

socket.on(
    "online_users",
    onlineUsers => {

        onlineUserIds =
            onlineUsers;

        updateOnlineStatus();
    }
);


/* =========================
   UPDATE ONLINE STATUS
========================= */

function updateOnlineStatus() {

    if (!selectedUser) {
        return;
    }

    const isOnline =
        onlineUserIds.some(
            id =>
                Number(id) ===
                Number(
                    selectedUser.user_id
                )
        );

    onlineStatus.textContent =
        isOnline
            ? "Online"
            : "Offline";
}


/* =========================
   TYPING
========================= */

let typingTimeout;

messageInput.addEventListener(
    "input",
    () => {

        if (!selectedUser) {
            return;
        }

        socket.emit(
            "typing",
            selectedUser.user_id
        );

        clearTimeout(
            typingTimeout
        );

        typingTimeout =
            setTimeout(
                () => {

                    socket.emit(
                        "stop_typing",
                        selectedUser.user_id
                    );

                },
                1000
            );
    }
);


/* =========================
   TYPING RECEIVED
========================= */

socket.on(
    "typing",
    data => {

        if (
            selectedUser &&
            Number(data.senderId) ===
            Number(
                selectedUser.user_id
            )
        ) {

            typingIndicator.textContent =
                `${selectedUser.name} is typing...`;
        }
    }
);


/* =========================
   STOP TYPING
========================= */

socket.on(
    "stop_typing",
    data => {

        if (
            selectedUser &&
            Number(data.senderId) ===
            Number(
                selectedUser.user_id
            )
        ) {

            typingIndicator.textContent =
                "";
        }
    }
);


/* =========================
   MARK MESSAGES AS READ
========================= */

async function markMessagesAsRead(userId) {

    try {

        const response =
            await fetch(
                `/api/messages/${userId}/read`,
                {
                    method: "POST",

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

        if (!response.ok) {

            console.log(
                "Failed to mark messages as read"
            );

            return;
        }

        console.log(
            "Messages marked as read"
        );

    } catch (error) {

        console.log(
            "Read status error:",
            error
        );
    }
}


/* =========================
   SEARCH USERS
========================= */

searchInput.addEventListener(
    "input",
    () => {

        const search =
            searchInput.value
                .toLowerCase()
                .trim();

        const filteredUsers =
            users.filter(
                user =>
                    user.name
                        .toLowerCase()
                        .includes(search)
                    ||
                    user.username
                        .toLowerCase()
                        .includes(search)
            );

        displayUsers(
            filteredUsers
        );
    }
);


/* =========================
   SEND BUTTON
========================= */

sendBtn.addEventListener(
    "click",
    sendMessage
);


/* =========================
   ENTER KEY
========================= */

messageInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();
        }
    }
);


/* =========================
   LOGOUT
========================= */

logoutBtn.addEventListener(
    "click",
    logout
);


function logout() {

    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "user"
    );

    window.location.href =
        "index.html";
}


/* =========================
   SCROLL
========================= */

function scrollToBottom() {

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}


/* =========================
   ESCAPE HTML
========================= */

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text;

    return div.innerHTML;
}


/* =========================
   SOCKET ERROR
========================= */

socket.on(
    "connect_error",
    error => {

        console.log(
            "Socket connection error:",
            error.message
        );
    }
);


/* =========================
   SOCKET CONNECTED
========================= */

socket.on(
    "connect",
    () => {

        console.log(
            "Socket connected:",
            socket.id
        );
    }
);


/* =========================
   START
========================= */

loadUsers();


/* =========================
   OPEN PROFILE PAGE
========================= */

const profileButton = document.getElementById("profileButton");

if (profileButton) {
    profileButton.addEventListener("click", () => {
        window.location.href = "/profile.html";
    });
}
