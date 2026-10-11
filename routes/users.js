
const express = require("express");
const db = require("../db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// GET ALL USERS WITH LAST MESSAGE AND UNREAD COUNT
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
        console.log("Users error:", error.message);
        res.status(500).json({
            message: "Failed to load users"
        });
    }
});


// GET LOGGED-IN USER PROFILE
router.get("/profile", authenticateToken, async (req, res) => {
    try {
        const currentUserId = req.user.userId;

        const [users] = await db.execute(
            `SELECT user_id, name, username, email, profile_picture
             FROM users
             WHERE user_id = ?`,
            [currentUserId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json(users[0]);
    } catch (error) {
        console.log("Profile error:", error.message);
        res.status(500).json({
            message: "Failed to load profile"
        });
    }
});


// UPDATE LOGGED-IN USER PROFILE
router.put("/profile", authenticateToken, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const { name, profile_picture } = req.body;

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                message: "Name is required"
            });
        }

        const cleanName = name.trim();

        if (cleanName.length > 100) {
            return res.status(400).json({
                message: "Name must be 100 characters or fewer"
            });
        }

        if (
            profile_picture !== undefined &&
            profile_picture !== null &&
            typeof profile_picture !== "string"
        ) {
            return res.status(400).json({
                message: "Profile picture must be a URL or null"
            });
        }

        const picture = profile_picture?.trim() || null;

        if (picture && picture.length > 500) {
            return res.status(400).json({
                message: "Profile picture URL is too long"
            });
        }

        if (
            picture &&
            !/^https?:\/\/\S+$/i.test(picture)
        ) {
            return res.status(400).json({
                message: "Enter a valid HTTP or HTTPS profile picture URL"
            });
        }

        const [result] = await db.execute(
            `UPDATE users
             SET name = ?, profile_picture = ?
             WHERE user_id = ?`,
            [cleanName, picture, currentUserId]
        );

        if (result.affectedRows === 0) {
            const [existingUsers] = await db.execute(
                "SELECT user_id FROM users WHERE user_id = ?",
                [currentUserId]
            );

            if (existingUsers.length === 0) {
                return res.status(404).json({
                    message: "User not found"
                });
            }
        }

        const [updatedUsers] = await db.execute(
            `SELECT user_id, name, username, email, profile_picture
             FROM users
             WHERE user_id = ?`,
            [currentUserId]
        );

        res.json({
            message: "Profile updated successfully",
            profile: updatedUsers[0]
        });
    } catch (error) {
        console.log("Update profile error:", error.message);
        res.status(500).json({
            message: "Failed to update profile"
        });
    }
});

module.exports = router;
