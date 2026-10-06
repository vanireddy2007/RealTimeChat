require("dotenv").config();

const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const db = require("./db");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const messageRoutes = require("./routes/messages");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(express.json());
app.use(express.static("public"));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);


/* =========================
   ONLINE USERS
========================= */

const onlineUsers = new Map();


/* =========================
   SOCKET AUTHENTICATION
========================= */

io.use((socket, next) => {

    try {

        const token =
            socket.handshake.auth.token;

        if (!token) {

            return next(
                new Error("Authentication required")
            );
        }

        const decoded =
            jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        socket.user = decoded;

        next();

    } catch (error) {

        next(
            new Error("Invalid token")
        );
    }
});


/* =========================
   SOCKET CONNECTION
========================= */

io.on("connection", (socket) => {

    const userId =
        socket.user.userId;

    console.log(
        "User connected:",
        userId
    );


    /* =========================
       JOIN USER ROOM
    ========================= */

    socket.join(
        `user_${userId}`
    );


    /* =========================
       STORE ONLINE USER
    ========================= */

    if (!onlineUsers.has(userId)) {

        onlineUsers.set(
            userId,
            new Set()
        );
    }

    onlineUsers
        .get(userId)
        .add(socket.id);


    /* =========================
       SEND ONLINE USERS
    ========================= */

    io.emit(
        "online_users",
        Array.from(
            onlineUsers.keys()
        )
    );


    /* =========================
       PRIVATE MESSAGE
    ========================= */

    socket.on(
        "private_message",
        async (data) => {

            try {

                const receiverId =
                    data.receiverId;

                const message =
                    data.message;


                if (
                    !receiverId ||
                    !message
                ) {
                    return;
                }


                /* INSERT MESSAGE */

                const [result] =
                    await db.execute(
                        `INSERT INTO messages
                        (
                            sender_id,
                            receiver_id,
                            message,
                            is_delivered,
                            is_read
                        )
                        VALUES (?, ?, ?, ?, ?)`,
                        [
                            userId,
                            receiverId,
                            message,
                            false,
                            false
                        ]
                    );


                const messageData = {

                    messageId:
                        result.insertId,

                    senderId:
                        userId,

                    receiverId:
                        receiverId,

                    message:
                        message,

                    sentAt:
                        new Date(),

                    isDelivered:
                        false,

                    isRead:
                        false,

                    deletedForEveryone:
                        false
                };


                /* =========================
                   SEND TO RECEIVER
                ========================= */

                io.to(
                    `user_${receiverId}`
                ).emit(
                    "private_message",
                    messageData
                );


                /* =========================
                   DELIVERY STATUS
                ========================= */

                if (
                    onlineUsers.has(
                        Number(receiverId)
                    )
                ) {

                    await db.execute(
                        `UPDATE messages
                         SET is_delivered = TRUE
                         WHERE message_id = ?`,
                        [
                            result.insertId
                        ]
                    );

                    messageData.isDelivered =
                        true;
                }


                /* =========================
                   SEND TO SENDER
                ========================= */

                socket.emit(
                    "message_sent",
                    messageData
                );


                /* =========================
                   DELIVERY EVENT
                ========================= */

                if (
                    messageData.isDelivered
                ) {

                    socket.emit(
                        "message_delivered",
                        {
                            messageId:
                                result.insertId,

                            receiverId:
                                receiverId
                        }
                    );
                }


            } catch (error) {

                console.log(
                    "Message error:",
                    error.message
                );
            }
        }
    );


    /* =========================
       DELETE MESSAGE FOR EVERYONE
    ========================= */

    socket.on(
        "delete_message",
        async (data) => {

            try {

                const messageId =
                    data.messageId;


                if (!messageId) {
                    return;
                }


                /* CHECK MESSAGE */

                const [messages] =
                    await db.execute(
                        `SELECT
                            message_id,
                            sender_id,
                            receiver_id

                         FROM messages

                         WHERE
                            message_id = ?
                            AND sender_id = ?`,
                        [
                            messageId,
                            userId
                        ]
                    );


                if (
                    messages.length === 0
                ) {

                    socket.emit(
                        "delete_message_error",
                        {
                            message:
                                "You cannot delete this message"
                        }
                    );

                    return;
                }


                const message =
                    messages[0];


                /* UPDATE DATABASE */

                await db.execute(
                    `UPDATE messages

                     SET
                        deleted_for_everyone = TRUE,
                        message = 'This message was deleted'

                     WHERE
                        message_id = ?
                        AND sender_id = ?`,
                    [
                        messageId,
                        userId
                    ]
                );


                /* =========================
                   NOTIFY SENDER
                ========================= */

                io.to(
                    `user_${userId}`
                ).emit(
                    "message_deleted",
                    {
                        messageId:
                            messageId,

                        deletedForEveryone:
                            true
                    }
                );


                /* =========================
                   NOTIFY RECEIVER
                ========================= */

                io.to(
                    `user_${message.receiver_id}`
                ).emit(
                    "message_deleted",
                    {
                        messageId:
                            messageId,

                        deletedForEveryone:
                            true
                    }
                );


                console.log(
                    `Message ${messageId} deleted for everyone by user ${userId}`
                );


            } catch (error) {

                console.log(
                    "Delete message error:",
                    error.message
                );
            }
        }
    );


    /* =========================
       DELETE MESSAGE FOR ME
    ========================= */

    socket.on(
        "delete_message_for_me",
        async (data) => {

            try {

                const messageId =
                    data.messageId;


                if (!messageId) {
                    return;
                }


                /* CHECK MESSAGE */

                const [messages] =
                    await db.execute(
                        `SELECT
                            message_id

                         FROM messages

                         WHERE
                            message_id = ?

                            AND (
                                sender_id = ?
                                OR
                                receiver_id = ?
                            )`,
                        [
                            messageId,
                            userId,
                            userId
                        ]
                    );


                if (
                    messages.length === 0
                ) {

                    socket.emit(
                        "delete_message_error",
                        {
                            message:
                                "Message not found"
                        }
                    );

                    return;
                }


                /* SAVE DELETE RECORD */

                await db.execute(
                    `INSERT IGNORE INTO deleted_messages
                    (
                        message_id,
                        user_id
                    )
                    VALUES (?, ?)`,
                    [
                        messageId,
                        userId
                    ]
                );


                /* REMOVE FROM CURRENT USER'S UI */

                socket.emit(
                    "message_deleted_for_me",
                    {
                        messageId:
                            messageId
                    }
                );


                console.log(
                    `Message ${messageId} deleted for user ${userId}`
                );


            } catch (error) {

                console.log(
                    "Delete for me error:",
                    error.message
                );
            }
        }
    );


    /* =========================
       TYPING
    ========================= */

    socket.on(
        "typing",
        (receiverId) => {

            socket
                .to(
                    `user_${receiverId}`
                )
                .emit(
                    "typing",
                    {
                        senderId:
                            userId
                    }
                );
        }
    );


    /* =========================
       STOP TYPING
    ========================= */

    socket.on(
        "stop_typing",
        (receiverId) => {

            socket
                .to(
                    `user_${receiverId}`
                )
                .emit(
                    "stop_typing",
                    {
                        senderId:
                            userId
                    }
                );
        }
    );


    /* =========================
       MESSAGES READ
    ========================= */

    socket.on(
        "messages_read",
        async (senderId) => {

            try {

                await db.execute(
                    `UPDATE messages

                     SET
                        is_delivered = TRUE,
                        is_read = TRUE

                     WHERE
                        sender_id = ?
                        AND receiver_id = ?
                        AND is_read = FALSE`,
                    [
                        senderId,
                        userId
                    ]
                );


                console.log(
                    `Messages from ${senderId} read by ${userId}`
                );


                /* NOTIFY SENDER */

                io.to(
                    `user_${senderId}`
                ).emit(
                    "messages_read",
                    {
                        readerId:
                            userId
                    }
                );


            } catch (error) {

                console.log(
                    "Read status socket error:",
                    error.message
                );
            }
        }
    );


    /* =========================
       DISCONNECT
    ========================= */

    socket.on(
        "disconnect",
        () => {

            console.log(
                "User disconnected:",
                userId
            );


            if (
                onlineUsers.has(userId)
            ) {

                onlineUsers
                    .get(userId)
                    .delete(
                        socket.id
                    );


                if (
                    onlineUsers
                        .get(userId)
                        .size === 0
                ) {

                    onlineUsers.delete(
                        userId
                    );
                }
            }


            /* UPDATE ONLINE USERS */

            io.emit(
                "online_users",
                Array.from(
                    onlineUsers.keys()
                )
            );
        }
    );
});


/* =========================
   START SERVER
========================= */

async function startServer() {

    try {

        const connection =
            await db.getConnection();


        console.log(
            "MySQL connected successfully"
        );


        connection.release();


        const PORT =
            process.env.PORT || 3000;


        server.listen(
            PORT,
            () => {

                console.log(
                    `Server running at http://localhost:${PORT}`
                );
            }
        );


    } catch (error) {

        console.log(
            "MySQL connection failed"
        );

        console.log(
            error.message
        );
    }
}


startServer();