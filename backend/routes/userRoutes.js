const express = require("express");
const router = express.Router();
const { db } = require("../config/firebase");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/me", authMiddleware, async (req, res) => {
  try {
    // Get the uid from req.user.uid
    const uid = req.user.uid;

    const docRef = db.collection("users").doc(uid);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "User profile not found." });
    }

    // If it does exist, return the profile
    res.status(200).json(doc.data());
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/create", authMiddleware, async (req, res) => {
  try {
    // 1. Get UID and email from the verified token
    const { uid, email } = req.user;

    // 2. Get the desired role and names from the request body
    const { role, firstName, lastName } = req.body;

    // 3. Check if user already exists
    const userRef = db.collection("users").doc(uid);
    const doc = await userRef.get();

    if (doc.exists) {
      // User already has a profile, just return it.
      return res.status(200).json(doc.data());
    }

    // 4. User is new. Create their profile based on the role.
    const commonData = {
      uid,
      email,
      createdAt: new Date(),
      firstName,
      lastName,
    };

    let newUserData;

    if (role === "parent") {
      newUserData = { ...commonData, role: "parent" };
    } else if (role === "school") {
      // 'school' from frontend becomes 'school-admin' in backend
      const organizationId = db.collection("organizations").doc().id;
      newUserData = {
        ...commonData,
        role: "school-admin",
        organizationId: organizationId,
      };
    } else if (role === "district") {
      // 'district' from frontend becomes 'district-admin' in backend
      const organizationId = db.collection("organizations").doc().id;
      newUserData = {
        ...commonData,
        role: "district-admin",
        organizationId: organizationId,
      };
    } else if (role === "employer") {
      // 'employer' from frontend becomes 'employer-admin' in backend
      const organizationId = db.collection("organizations").doc().id;
      newUserData = {
        ...commonData,
        role: "employer-admin",
        organizationId: organizationId,
      };
    } else {
      // Default to 'parent' if role is missing or invalid
      newUserData = { ...commonData, role: "parent" };
    }

    // 5. Save the new user to Firestore
    await userRef.set(newUserData);

    // 6. Return the new profile
    res.status(201).json(newUserData);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
