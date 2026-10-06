const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../db");

const router = express.Router();


// =========================
// REGISTER
// =========================
router.post("/register", async (req, res) => {

    try {

        const {
            name,
            username,
            email,
            password
        } = req.body;

        // Check empty fields
        if (!name || !username || !email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        // Check password length
        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters"
            });
        }

        // Check whether username or email already exists
        const [existingUsers] = await db.execute(
            `SELECT user_id
             FROM users
             WHERE username = ? OR email = ?`,
            [username, email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                message: "Username or email already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const [result] = await db.execute(
            `INSERT INTO users
            (name, username, email, password)
            VALUES (?, ?, ?, ?)`,
            [
                name,
                username,
                email,
                hashedPassword
            ]
        );

        res.status(201).json({
            message: "Registration successful",
            userId: result.insertId
        });

    } catch (error) {

        console.log("Registration error:", error.message);

        res.status(500).json({
            message: "Server error"
        });
    }
});


// =========================
// LOGIN
// =========================
router.post("/login", async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;

        // Check fields
        if (!username || !password) {
            return res.status(400).json({
                message: "Username/email and password are required"
            });
        }

        // Find user
        const [users] = await db.execute(
            `SELECT *
             FROM users
             WHERE username = ? OR email = ?`,
            [username, username]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "Invalid username/email or password"
            });
        }

        const user = users[0];

        // Compare password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid username/email or password"
            });
        }

        // Create JWT
        const token = jwt.sign(
            {
                userId: user.user_id,
                username: user.username,
                name: user.name
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.json({
            message: "Login successful",

            token: token,

            user: {
                userId: user.user_id,
                name: user.name,
                username: user.username,
                email: user.email,
                profilePicture: user.profile_picture
            }
        });

    } catch (error) {

        console.log("Login error:", error.message);

        res.status(500).json({
            message: "Server error"
        });
    }
});


module.exports = router;