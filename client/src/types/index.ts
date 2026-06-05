
// Common types used across the application
export interface NavigationItem {
  label: string;
  position: string;
  href?: string;
}

export interface EventCard {
  title: string;
  description: string;
  date: string;
  image: string;
}

export interface TestimonialData {
  name: string;
  content: string;
  role?: string;
}
