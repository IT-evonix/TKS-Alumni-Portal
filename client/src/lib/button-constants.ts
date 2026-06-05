/**
 * Button Design System Constants
 * 
 * This file contains standardized constants for button text, actions, and styling
 * to ensure consistency across the entire application.
 */

// Standard button action labels (consistent casing: Title Case)
export const BUTTON_LABELS = {
  // Primary Actions
  SAVE: "Save",
  SAVE_CHANGES: "Save Changes",
  SUBMIT: "Submit",
  CONFIRM: "Confirm",
  CREATE: "Create",
  UPDATE: "Update",
  
  // Add/New Actions
  ADD: "Add",
  ADD_EXPERIENCE: "Add Experience",
  ADD_EDUCATION: "Add Education",
  ADD_PROJECT: "Add Project",
  ADD_CERTIFICATION: "Add Certification",
  ADD_SKILL: "Add Skill",
  ADD_LANGUAGE: "Add Language",
  ADD_ACHIEVEMENT: "Add Achievement",
  NEW: "New",
  NEW_THREAD: "New Thread",
  NEW_JOB: "Post a Job Opening",
  NEW_EVENT: "Post an Event",
  
  // Delete/Remove Actions
  DELETE: "Delete",
  REMOVE: "Remove",
  CANCEL: "Cancel",
  CLOSE: "Close",
  
  // Navigation Actions
  BACK: "Back",
  NEXT: "Next",
  CONTINUE: "Continue",
  FINISH: "Finish",
  
  // Connection/Action Actions
  CONNECT: "Connect",
  ACCEPT: "Accept",
  REJECT: "Reject",
  WITHDRAW: "Withdraw",
  REQUEST_MENTORSHIP: "Request Mentorship",
  
  // Edit Actions
  EDIT: "Edit",
  
  // Share Actions
  SHARE: "Share",
  
  // Login/Auth Actions
  LOGIN: "Login",
  LOGOUT: "Log Out",
  SIGNUP: "Sign Up",
  REGISTER: "Register",
  
  // Status Actions
  ENABLE: "Enable",
  DISABLE: "Disable",
  BECOME_MENTOR: "Become a Mentor",
  DISABLE_MENTOR: "Disable Mentor Status",
} as const;

// Button variant usage guidelines
export const BUTTON_VARIANTS = {
  // Primary brand actions (main CTA, save, submit)
  PRIMARY: "brand",
  
  // Destructive actions (delete, remove)
  DESTRUCTIVE: "destructive",
  
  // Secondary actions (cancel, close)
  SECONDARY: "outline",
  
  // Tertiary actions (ghost buttons, less prominent)
  TERTIARY: "ghost",
} as const;

// Button size usage guidelines
export const BUTTON_SIZES = {
  SMALL: "sm",
  DEFAULT: "default",
  LARGE: "lg",
  ICON: "icon",
} as const;

// Minimum button dimensions for accessibility
export const BUTTON_MIN_DIMENSIONS = {
  TOUCH_TARGET: 44, // pixels - minimum for mobile/touch
  MIN_WIDTH: 80, // pixels - minimum for text buttons
} as const;

// Standard button text casing
export const BUTTON_TEXT_CASING = {
  PRIMARY: "title-case", // "Save Changes", "Add Experience"
  SECONDARY: "title-case", // "Cancel", "Delete"
} as const;
