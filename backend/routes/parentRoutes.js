const express = require("express");
const router = express.Router();
const { admin, db } = require("../config/firebase");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/create-child", authMiddleware, async (req, res) => {
  try {
    // Security Check: Verify the user is a parent
    const parentRef = db.collection("users").doc(req.user.uid);
    const parentDoc = await parentRef.get();

    if (!parentDoc.exists || parentDoc.data().role !== "parent") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const parentId = parentDoc.id;

    // Check Child Limit: Get a reference to the parentStudentLinks doc, check the studentUids array
    const linkRef = db.collection("parentStudentLinks").doc(parentId);
    const linkDoc = await linkRef.get();

    if (
      linkDoc.exists &&
      linkDoc.data().studentUids &&
      linkDoc.data().studentUids.length >= 10
    ) {
      return res
        .status(400)
        .json({ error: "Maximum of 10 children allowed per parent" });
    }

    // Get Data: Get email, password, firstName, lastName from req.body
    const { email, password, firstName, lastName } = req.body;

    // Create Child in Auth
    const newChildUser = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: true, // Add this line
    });

    // Create Child in Firestore
    await db.collection("users").doc(newChildUser.uid).set({
      uid: newChildUser.uid,
      email,
      firstName,
      lastName,
      role: "student",
    });

    // Link Child to Parent
    await linkRef.set(
      { studentUids: admin.firestore.FieldValue.arrayUnion(newChildUser.uid) },
      { merge: true }
    );

    // Send a 201 (Created) response with the new child's data
    res.status(201).json({
      uid: newChildUser.uid,
      email,
      firstName,
      lastName,
      role: "student",
      displayName: newChildUser.displayName,
    });
  } catch (error) {
    // Handle specific error cases
    if (error.code === "auth/email-already-exists") {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Generic error handling
    console.error("Error creating child:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
