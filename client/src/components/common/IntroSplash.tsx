"use client";

import React, { useEffect, useState } from "react";

const IntroSplash = () => {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Start opening after 2 seconds
    const openTimer = setTimeout(() => {
      setAnimate(true);
    }, 2000);

    // Remove component after animation
    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 4200);

    return () => {
      clearTimeout(openTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="hand_opens">
      <div className={`left-div ${animate ? "open-left" : ""}`}>
        <img src="/images/hand1.webp" alt="Left Hand" />
      </div>

      <div className={`right-div ${animate ? "open-right" : ""}`}>
        <img src="/images/hand2.webp" alt="Right Hand" />
      </div>
    </div>
  );
};

export {IntroSplash};