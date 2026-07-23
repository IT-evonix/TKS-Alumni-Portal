import React from "react";
import { AnimatePresence, motion } from "framer-motion";

const SESSION_KEY = "tks-intro-splash-played";

export const IntroSplash = (): JSX.Element | null => {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    setShow(true);
    const timer = setTimeout(() => setShow(false), 1400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4, delay: 0.5 } }}
        >
          <motion.span
            className="text-[7rem] sm:text-[9rem]"
            style={{ willChange: "transform, opacity" }}
            initial={{ scale: 1, y: 0, opacity: 1, filter: "blur(0px)" }}
            animate={{
              scale: 0.05,
              y: -60,
              opacity: 0,
              filter: "blur(6px)",
            }}
            transition={{
              duration: 1.1,
              delay: 0.35,
              ease: [0.6, 0, 0.85, 1],
            }}
          >
            🙏
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
