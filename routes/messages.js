const express = require("express");

const db = require("../db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();


/* =========================
   GET CHAT MESSAGES
========================= */

router.get("/:userId", authenticateToken, async (req, res) => {

    try {

        const currentUserId =
            req.user.userId;

        const otherUserId =
            req.params.userId;


        const [messages] =
            await db.execute(
                `SELECT
                    message_id,
                    sender_id,
                    receiver_id,
                    message,
                    sent_at,
                    is_delivered,
                    is_read,
                    deleted_for_everyone

                 FROM messages

                 WHERE
                    (sender_id = ? AND receiver_id = ?)
                    OR
                    (sender_id = ? AND receiver_id = ?)

                 ORDER BY sent_at ASC`,

                [
                    currentUserId,
                    otherUserId,
                    otherUserId,
                    currentUserId
                ]
            );


        res.json(messages);


    } catch (error) {

        console.log(
            "Messages error:",
            error.message
        );

        res.status(500).json({
            message:
                "Failed to load messages"
        });
    }
});


/* =========================
   MARK MESSAGES AS READ
========================= */

router.post(
    "/:userId/read",
    authenticateToken,
    async (req, res) => {

        try {

            const currentUserId =
                req.user.userId;

            const otherUserId =
                req.params.userId;


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
                    otherUserId,
                    currentUserId
                ]
            );


            res.json({
                message:
                    "Messages marked as read"
            });


        } catch (error) {

            console.log(
                "Read message error:",
                error.message
            );

            res.status(500).json({
                message:
                    "Failed to mark messages as read"
            });
        }
    }
);


/* =========================
   DELETE MESSAGE FOR EVERYONE
========================= */

router.delete(
    "/message/:messageId",
    authenticateToken,
    async (req, res) => {

        try {

            const currentUserId =
                req.user.userId;

            const messageId =
                req.params.messageId;


            const [result] =
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
                        currentUserId
                    ]
                );


            if (result.affectedRows === 0) {

                return res.status(404).json({
                    message:
                        "Message not found or you are not the sender"
                });
            }


            res.json({
                message:
                    "Message deleted successfully"
            });


        } catch (error) {

            console.log(
                "Delete message error:",
                error.message
            );

            res.status(500).json({
                message:
                    "Failed to delete message"
            });
        }
    }
);


module.exports = router;