
import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { COUNTRY_CODES, parsePhoneNumber, formatPhoneNumber, validatePhoneNumber, CountryCode } from '@/utils/phoneValidation';
import { cn } from '@/lib/utils';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  name?: string;
  error?: string;
}

const indiaCode = COUNTRY_CODES.find(c => c.code === 'IN');

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = 'Enter phone number',
  name,
  error
}) => {
  const sortedCountryCodes = React.useMemo(() => {
    const india = COUNTRY_CODES.find(c => c.code === 'IN');
    const others = COUNTRY_CODES.filter(c => c.code !== 'IN').sort((a, b) => a.name.localeCompare(b.name));
    return india ? [india, ...others] : others;
  }, []);

  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    indiaCode || sortedCountryCodes[0]
  );
  const [phoneNumber, setPhoneNumber] = useState('');
  const [validationError, setValidationError] = useState<string>('');
  const [open, setOpen] = useState(false);

  // Initialize from value and sync when changed externally
  useEffect(() => {
    if (value) {
      const parsed = parsePhoneNumber(value);
      if (parsed.country) {
        if (parsed.country.code !== selectedCountry.code) {
          setSelectedCountry(parsed.country);
        }
        if (parsed.number !== phoneNumber) {
          setPhoneNumber(parsed.number);
        }
      }
    }
  }, [value, selectedCountry.code, phoneNumber]);

  const handleCountryChange = (countryCode: string) => {
    const country = COUNTRY_CODES.find(c => c.code === countryCode);
    if (country) {
      setSelectedCountry(country);
      setPhoneNumber('');
      setValidationError('');
      onChange(country.dialCode);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const digitsOnly = input.replace(/\D/g, '');

    // Enforce max length
    if (digitsOnly.length > selectedCountry.maxLength) {
      return;
    }

    setPhoneNumber(digitsOnly);

    // Validate only if user has entered something
    if (digitsOnly.length > 0) {
      const validation = validatePhoneNumber(digitsOnly, selectedCountry);
      setValidationError(validation.error || '');
    } else {
      setValidationError('');
    }

    // Update parent with full phone number
    const fullNumber = digitsOnly ? `${selectedCountry.dialCode} ${digitsOnly}` : selectedCountry.dialCode;
    onChange(fullNumber);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow backspace, delete, tab, escape, enter
    if ([8, 9, 27, 13, 46].includes(e.keyCode)) {
      return;
    }
    // Allow Ctrl/Cmd+A, Ctrl/Cmd+C, Ctrl/Cmd+V, Ctrl/Cmd+X
    if ((e.ctrlKey || e.metaKey) && [65, 67, 86, 88].includes(e.keyCode)) {
      return;
    }
    // Allow arrow keys
    if (e.keyCode >= 35 && e.keyCode <= 40) {
      return;
    }
    // Prevent if not a number
    if ((e.keyCode < 48 || e.keyCode > 57) && (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault();
    }
  };

  const displayValue = phoneNumber ? formatPhoneNumber(phoneNumber, selectedCountry) : '';
  const showError = error || validationError;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex gap-0 relative h-11">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-11 w-[110px] justify-between border-gray-200 border-r-0 rounded-r-none bg-gray-50 hover:bg-gray-100 px-2 sm:px-3 text-black text-xs shrink-0 focus:z-10"
              disabled={disabled}
            >
              <div className="flex items-center gap-1 truncate">
                <span className="font-semibold text-black text-xs">{selectedCountry.dialCode}</span>
                <span className="text-gray-500 text-[10px] opacity-70">
                  ({selectedCountry.code})
                </span>
              </div>
              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50 text-gray-500" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0 z-[10000]" align="start">
            <Command>
              <CommandInput placeholder="Search country..." />
              <CommandList
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup>
                  {sortedCountryCodes.map((country) => (
                    <CommandItem
                      key={country.code}
                      value={`${country.name} ${country.dialCode} ${country.code}`}
                      onSelect={() => {
                        handleCountryChange(country.code);
                        setOpen(false);
                      }}
                      className={cn(
                        selectedCountry.code === country.code && "bg-accent"
                      )}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedCountry.code === country.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{country.dialCode}</span>
                        <span className="text-sm text-gray-600">{country.name}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="flex-1 relative h-11 group/phone">
          <input
            type="tel"
            name={name}
            value={displayValue}
            onChange={handlePhoneChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="tel"
            className={cn(
              // Base styles
              'h-11 w-full pl-4 pr-16 rounded-md rounded-l-none border border-l-0 text-sm outline-none transition-all',
              // Colors
              'border-gray-200 bg-white text-black placeholder:text-gray-400',
              // Focus state
              'focus:border-[#008060] focus:ring-2 focus:ring-[#008060]/20 focus:ring-inset',
              // Error state
              showError && 'border-red-500 focus:ring-red-500'
            )}
            style={{
              color: 'black',
              opacity: 1,
              WebkitTextFillColor: 'black',
              backgroundColor: 'white'
            }}
            maxLength={selectedCountry.maxLength + 5} // Extra for formatting
          />
          
          {/* Internal Character Counter (Absolutely Positioned) */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none select-none">
            {phoneNumber.length > 0 && (
              <div className={cn(
                "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md",
                phoneNumber.length === selectedCountry.maxLength ? "bg-[#008060]/10 text-[#008060]" : "bg-neutral-100 text-neutral-400"
              )}>
                {phoneNumber.length}/{selectedCountry.maxLength}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Errors & Help Text below the input row */}
      {showError && (
        <p className="text-[10px] text-red-500 flex items-center gap-1 mt-1 px-1">
          <span>⚠️</span>
          {showError}
        </p>
      )}

      {!showError && selectedCountry.format && phoneNumber && (
        <p className="text-[9px] text-gray-400 flex items-center gap-1 px-1 mt-0.5">
          <span className="opacity-50 uppercase font-black">Format:</span>
          <span className="font-mono bg-gray-50 px-1 rounded border border-gray-100">
            {selectedCountry.format.replace(/X/g, '0')}
          </span>
        </p>
      )}
    </div>
  );
};
