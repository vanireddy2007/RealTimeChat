const express = require("express");

const db = require("../db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
    try {

        const currentUserId = req.user.userId;

        const [users] = await db.execute(
            `SELECT
                u.user_id,
                u.name,
                u.username,
                u.email,
                u.profile_picture,

                (
                    SELECT m.message
                    FROM messages m
                    WHERE
                        (m.sender_id = u.user_id AND m.receiver_id = ?)
                        OR
                        (m.sender_id = ? AND m.receiver_id = u.user_id)
                    ORDER BY m.sent_at DESC
                    LIMIT 1
                ) AS last_message,

                (
                    SELECT m.sent_at
                    FROM messages m
                    WHERE
                        (m.sender_id = u.user_id AND m.receiver_id = ?)
                        OR
                        (m.sender_id = ? AND m.receiver_id = u.user_id)
                    ORDER BY m.sent_at DESC
                    LIMIT 1
                ) AS last_message_time,

                (
                    SELECT COUNT(*)
                    FROM messages m
                    WHERE
                        m.sender_id = u.user_id
                        AND m.receiver_id = ?
                        AND m.is_read = FALSE
                ) AS unread_count

            FROM users u

            WHERE u.user_id != ?

            ORDER BY
                last_message_time IS NULL ASC,
                last_message_time DESC,
                u.name ASC`,
            [
                currentUserId,
                currentUserId,
                currentUserId,
                currentUserId,
                currentUserId,
                currentUserId
            ]
        );

        res.json(users);

    } catch (error) {

        console.log(
            "Users error:",
            error.message
        );

        res.status(500).json({
            message: "Failed to load users"
        });
    }
});

module.exports = router;