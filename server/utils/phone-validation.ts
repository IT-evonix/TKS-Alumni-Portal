// Phone number validation utility for backend (server-side)
// Supports multiple country codes with different length requirements

export interface CountryCode {
  code: string;
  name: string;
  dialCode: string;
  minLength: number;
  maxLength: number;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: 'IN', name: 'India', dialCode: '+91', minLength: 10, maxLength: 10 },
  { code: 'AR', name: 'Argentina', dialCode: '+54', minLength: 10, maxLength: 11 },
  { code: 'AU', name: 'Australia', dialCode: '+61', minLength: 9, maxLength: 9 },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', minLength: 10, maxLength: 10 },
  { code: 'BR', name: 'Brazil', dialCode: '+55', minLength: 10, maxLength: 11 },
  { code: 'CA', name: 'Canada', dialCode: '+1', minLength: 10, maxLength: 10 },
  { code: 'CL', name: 'Chile', dialCode: '+56', minLength: 9, maxLength: 9 },
  { code: 'CN', name: 'China', dialCode: '+86', minLength: 11, maxLength: 11 },
  { code: 'CO', name: 'Colombia', dialCode: '+57', minLength: 10, maxLength: 10 },
  { code: 'EG', name: 'Egypt', dialCode: '+20', minLength: 10, maxLength: 10 },
  { code: 'FR', name: 'France', dialCode: '+33', minLength: 9, maxLength: 9 },
  { code: 'DE', name: 'Germany', dialCode: '+49', minLength: 10, maxLength: 11 },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', minLength: 9, maxLength: 12 },
  { code: 'IT', name: 'Italy', dialCode: '+39', minLength: 9, maxLength: 10 },
  { code: 'JP', name: 'Japan', dialCode: '+81', minLength: 10, maxLength: 10 },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', minLength: 9, maxLength: 10 },
  { code: 'MX', name: 'Mexico', dialCode: '+52', minLength: 10, maxLength: 10 },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', minLength: 9, maxLength: 9 },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', minLength: 9, maxLength: 10 },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', minLength: 10, maxLength: 10 },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', minLength: 10, maxLength: 10 },
  { code: 'PH', name: 'Philippines', dialCode: '+63', minLength: 10, maxLength: 10 },
  { code: 'PL', name: 'Poland', dialCode: '+48', minLength: 9, maxLength: 9 },
  { code: 'RU', name: 'Russia', dialCode: '+7', minLength: 10, maxLength: 10 },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', minLength: 9, maxLength: 9 },
  { code: 'SG', name: 'Singapore', dialCode: '+65', minLength: 8, maxLength: 8 },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', minLength: 9, maxLength: 9 },
  { code: 'KR', name: 'South Korea', dialCode: '+82', minLength: 9, maxLength: 10 },
  { code: 'ES', name: 'Spain', dialCode: '+34', minLength: 9, maxLength: 9 },
  { code: 'SE', name: 'Sweden', dialCode: '+46', minLength: 9, maxLength: 10 },
  { code: 'TH', name: 'Thailand', dialCode: '+66', minLength: 9, maxLength: 9 },
  { code: 'TR', name: 'Turkey', dialCode: '+90', minLength: 10, maxLength: 10 },
  { code: 'AE', name: 'UAE', dialCode: '+971', minLength: 9, maxLength: 9 },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', minLength: 10, maxLength: 10 },
  { code: 'US', name: 'United States', dialCode: '+1', minLength: 10, maxLength: 10 },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', minLength: 9, maxLength: 10 },
];

export const parsePhoneNumber = (phone: string): { dialCode: string; number: string; country?: CountryCode } => {
  const cleaned = phone.replace(/\D/g, '');
  
  // Try to match country code (sort by length descending to match longer codes first)
  for (const country of COUNTRY_CODES.sort((a, b) => b.dialCode.length - a.dialCode.length)) {
    const dialCodeDigits = country.dialCode.replace('+', '');
    if (cleaned.startsWith(dialCodeDigits)) {
      return {
        dialCode: country.dialCode,
        number: cleaned.substring(dialCodeDigits.length),
        country
      };
    }
  }
  
  // Default to India if no match
  return {
    dialCode: '+91',
    number: cleaned.startsWith('91') ? cleaned.substring(2) : cleaned,
    country: COUNTRY_CODES.find(c => c.code === 'IN')
  };
};

export const validatePhoneNumber = (phone: string, country?: CountryCode): { valid: boolean; error?: string } => {
  const cleaned = phone.replace(/\D/g, '');
  
  if (!country) {
    return { valid: false, error: 'Please select a country code' };
  }
  
  // If minLength equals maxLength, enforce exact length
  if (country.minLength === country.maxLength) {
    if (cleaned.length !== country.minLength) {
      return { valid: false, error: `Phone number must be exactly ${country.minLength} digits` };
    }
  } else {
    // For countries with variable length
    if (cleaned.length < country.minLength) {
      return { valid: false, error: `Phone number must be at least ${country.minLength} digits` };
    }
    
    if (cleaned.length > country.maxLength) {
      return { valid: false, error: `Phone number cannot exceed ${country.maxLength} digits` };
    }
  }
  
  return { valid: true };
};
