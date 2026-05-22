import { Router } from "express";
import { supabase } from "../supabase";
import bcrypt from "bcryptjs";
import { promisify } from "util";
import { changeEmailSchema, changeUsernameSchema } from "../../shared/validation";

const router = Router();

const hashPassword = promisify(bcrypt.hash);
const comparePassword = promisify(bcrypt.compare);

// Update Password Route Removed per security requirements
// Password updates should only happen via the Forgot Password email flow.

// Update Email
router.put("/email", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const validation = changeEmailSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: validation.error.errors[0].message });
        }

        const { currentPassword, newEmail } = validation.data;

        // Get user for password verification
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("password, email")
            .eq("id", userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Verify current password
        const isValid = await comparePassword(currentPassword, user.password);
        if (!isValid) {
            return res.status(401).json({ error: "Incorrect current password" });
        }

        if (user.email === newEmail) {
            return res.status(400).json({ error: "New email must be different" });
        }

        // Check if email already exists
        const { data: existingEmail } = await supabase
            .from("users")
            .select("id")
            .eq("email", newEmail)
            .single();

        if (existingEmail) {
            return res.status(400).json({ error: "Email is already in use" });
        }

        // Update email
        const { error: updateError } = await supabase
            .from("users")
            .update({ email: newEmail })
            .eq("id", userId);

        if (updateError) {
            console.error("Update email error:", updateError);
            return res.status(500).json({ error: "Failed to update email" });
        }

        // Also update alumni email if exists
        await supabase
            .from("alumni")
            .update({ email: newEmail })
            .eq("user_id", userId);

        res.json({ message: "Email updated successfully" });

    } catch (error) {
        console.error("Email update error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Update Username
router.put("/username", async (req, res) => {
    try {
        const userId = req.headers["user-id"] as string;
        if (!userId) return res.status(401).json({ error: "No user ID provided" });

        const validation = changeUsernameSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: validation.error.errors[0].message });
        }

        const { currentPassword, newUsername } = validation.data;

        // Get user
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("password, username")
            .eq("id", userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Verify password
        const isValid = await comparePassword(currentPassword, user.password);
        if (!isValid) {
            return res.status(401).json({ error: "Incorrect current password" });
        }

        if (user.username === newUsername) {
            return res.status(400).json({ error: "New username must be different" });
        }

        // Check uniqueness
        const { data: existingUsername } = await supabase
            .from("users")
            .select("id")
            .eq("username", newUsername)
            .single();

        if (existingUsername) {
            return res.status(400).json({ error: "Username is already taken" });
        }

        // Update username
        const { error: updateError } = await supabase
            .from("users")
            .update({ username: newUsername })
            .eq("id", userId);

        if (updateError) {
            console.error("Update username error:", updateError);
            return res.status(500).json({ error: "Failed to update username" });
        }

        res.json({ message: "Username updated successfully" });

    } catch (error) {
        console.error("Username update error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
