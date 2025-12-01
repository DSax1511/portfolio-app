import React from "react";

/**
 * DEBUG TEST COMPONENT
 * Use this to verify that code changes are actually being reflected on the website.
 * 
 * Instructions:
 * 1. Import this component into any page (e.g., MathEnginePage.jsx)
 * 2. Make a visible change to the content below (e.g., change the text or background color)
 * 3. Save the file and watch your browser - Vite HMR should hot-reload
 * 4. If you don't see the change, your dev server isn't running or changes aren't being picked up
 * 
 * Test ID: CHANGE_THIS_VALUE_TO_TEST_UPDATES
 */
export const DebugTest = () => {
  return (
    <div
      style={{
        padding: "20px",
        margin: "20px 0",
        backgroundColor: "#FFD700", // GOLD - Change this color to test
        border: "3px solid #FF0000", // RED - Change this border to test
        borderRadius: "8px",
        textAlign: "center",
      }}
    >
      <h3 style={{ color: "#000", margin: "0 0 10px 0" }}>
        🔍 DEBUG TEST - CHANGE THIS TEXT TO VERIFY UPDATES
      </h3>
      <p style={{ color: "#000", margin: 0, fontWeight: "bold" }}>
        If you can see this message and it changes when you edit the file, your changes ARE being reflected!
      </p>
      <p style={{ color: "#000", margin: "10px 0 0 0", fontSize: "12px" }}>
        Test Timestamp: {new Date().toLocaleTimeString()}
      </p>
    </div>
  );
};

export default DebugTest;
