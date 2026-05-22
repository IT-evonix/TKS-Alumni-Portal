
// Phone number validation utility with country code support
export interface CountryCode {
  code: string;
  name: string;
  dialCode: string;
  minLength: number;
  maxLength: number;
  format?: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: 'IN', name: 'India', dialCode: '+91', minLength: 10, maxLength: 10, format: 'XXXXX XXXXX' },
  { code: 'AR', name: 'Argentina', dialCode: '+54', minLength: 10, maxLength: 11, format: 'XXX XXX XXXX' },
  { code: 'AU', name: 'Australia', dialCode: '+61', minLength: 9, maxLength: 9, format: 'XXX XXX XXX' },
  { code: 'BD', name: 'Bangladesh', dialCode: '+880', minLength: 10, maxLength: 10, format: 'XXXX XXX XXX' },
  { code: 'BR', name: 'Brazil', dialCode: '+55', minLength: 10, maxLength: 11, format: 'XX XXXXX XXXX' },
  { code: 'CA', name: 'Canada', dialCode: '+1', minLength: 10, maxLength: 10, format: '(XXX) XXX-XXXX' },
  { code: 'CL', name: 'Chile', dialCode: '+56', minLength: 9, maxLength: 9, format: 'X XXXX XXXX' },
  { code: 'CN', name: 'China', dialCode: '+86', minLength: 11, maxLength: 11, format: 'XXX XXXX XXXX' },
  { code: 'CO', name: 'Colombia', dialCode: '+57', minLength: 10, maxLength: 10, format: 'XXX XXX XXXX' },
  { code: 'EG', name: 'Egypt', dialCode: '+20', minLength: 10, maxLength: 10, format: 'XXX XXX XXXX' },
  { code: 'FR', name: 'France', dialCode: '+33', minLength: 9, maxLength: 9, format: 'X XX XX XX XX' },
  { code: 'DE', name: 'Germany', dialCode: '+49', minLength: 10, maxLength: 11, format: 'XXX XXXXXXX' },
  { code: 'ID', name: 'Indonesia', dialCode: '+62', minLength: 9, maxLength: 12, format: 'XXX XXXX XXXX' },
  { code: 'IT', name: 'Italy', dialCode: '+39', minLength: 9, maxLength: 10, format: 'XXX XXX XXXX' },
  { code: 'JP', name: 'Japan', dialCode: '+81', minLength: 10, maxLength: 10, format: 'XX XXXX XXXX' },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', minLength: 9, maxLength: 10, format: 'XX XXXX XXXX' },
  { code: 'MX', name: 'Mexico', dialCode: '+52', minLength: 10, maxLength: 10, format: 'XXX XXX XXXX' },
  { code: 'NL', name: 'Netherlands', dialCode: '+31', minLength: 9, maxLength: 9, format: 'X XX XX XX XX' },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', minLength: 9, maxLength: 10, format: 'XX XXX XXXX' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', minLength: 10, maxLength: 10, format: 'XXX XXX XXXX' },
  { code: 'PK', name: 'Pakistan', dialCode: '+92', minLength: 10, maxLength: 10, format: 'XXX XXX XXXX' },
  { code: 'PH', name: 'Philippines', dialCode: '+63', minLength: 10, maxLength: 10, format: 'XXX XXX XXXX' },
  { code: 'PL', name: 'Poland', dialCode: '+48', minLength: 9, maxLength: 9, format: 'XXX XXX XXX' },
  { code: 'RU', name: 'Russia', dialCode: '+7', minLength: 10, maxLength: 10, format: 'XXX XXX XX XX' },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', minLength: 9, maxLength: 9, format: 'XX XXX XXXX' },
  { code: 'SG', name: 'Singapore', dialCode: '+65', minLength: 8, maxLength: 8, format: 'XXXX XXXX' },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', minLength: 9, maxLength: 9, format: 'XX XXX XXXX' },
  { code: 'KR', name: 'South Korea', dialCode: '+82', minLength: 9, maxLength: 10, format: 'XX XXXX XXXX' },
  { code: 'ES', name: 'Spain', dialCode: '+34', minLength: 9, maxLength: 9, format: 'XXX XX XX XX' },
  { code: 'SE', name: 'Sweden', dialCode: '+46', minLength: 9, maxLength: 10, format: 'XX XXX XX XX' },
  { code: 'TH', name: 'Thailand', dialCode: '+66', minLength: 9, maxLength: 9, format: 'X XXXX XXXX' },
  { code: 'TR', name: 'Turkey', dialCode: '+90', minLength: 10, maxLength: 10, format: 'XXX XXX XX XX' },
  { code: 'AE', name: 'UAE', dialCode: '+971', minLength: 9, maxLength: 9, format: 'XX XXX XXXX' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', minLength: 10, maxLength: 10, format: 'XXXX XXX XXX' },
  { code: 'US', name: 'United States', dialCode: '+1', minLength: 10, maxLength: 10, format: '(XXX) XXX-XXXX' },
  { code: 'VN', name: 'Vietnam', dialCode: '+84', minLength: 9, maxLength: 10, format: 'XXX XXX XXXX' },
];

export const getCountryByDialCode = (dialCode: string): CountryCode | undefined => {
  return COUNTRY_CODES.find(country => dialCode.startsWith(country.dialCode));
};

export const parsePhoneNumber = (phone: string): { dialCode: string; number: string; country?: CountryCode } => {
  const cleaned = phone.replace(/\D/g, '');
  
  // Try to match country code
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

export const formatPhoneNumber = (phone: string, country?: CountryCode): string => {
  if (!country) return phone;
  
  const digits = phone.replace(/\D/g, '');
  if (!country.format) return digits;
  
  let formatted = '';
  let digitIndex = 0;
  
  for (let i = 0; i < country.format.length && digitIndex < digits.length; i++) {
    if (country.format[i] === 'X') {
      formatted += digits[digitIndex++];
    } else {
      formatted += country.format[i];
    }
  }
  
  return formatted;
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

export const formatPhoneWithDialCode = (dialCode: string, number: string, country?: CountryCode): string => {
  if (!number) return dialCode;
  const formatted = country ? formatPhoneNumber(number, country) : number;
  return `${dialCode} ${formatted}`;
};
