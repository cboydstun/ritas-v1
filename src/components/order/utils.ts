export const getNextDay = (dateStr: string): string => {
  // Append T00:00:00 so the date is parsed as local midnight, not UTC midnight
  const date = new Date(dateStr + "T00:00:00");
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
  return phoneRegex.test(phone);
};

export const validateZipCode = (zipCode: string): boolean => {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zipCode);
};

export const isBexarCountyZipCode = (zipCode: string): boolean => {
  // Remove any non-digit characters (like dashes)
  const cleanZip = zipCode.replace(/\D/g, "");

  // Main San Antonio/Bexar County ZIP codes
  const bexarZips = [
    // Main San Antonio ZIP ranges (78201-78299)
    ...Array.from({ length: 99 }, (_, i) => `782${String(i).padStart(2, "0")}`),

    // Additional Bexar County ZIPs
    "78002",
    "78006",
    "78009",
    "78015",
    "78023",
    "78039",
    "78052",
    "78054",
    "78056",
    "78069",
    "78073",
    "78101",
    "78108",
    "78109",
    "78112",
    "78124",
    "78148",
    "78150",
    "78152",
    "78154",
    "78163",
  ];

  return bexarZips.includes(cleanZip);
};

export const validateDeliveryTime = (time: string): boolean => {
  if (time === "ANY") return true;
  if (!time) return false;
  const [hours, minutes] = time.split(":").map(Number);
  const timeInMinutes = hours * 60 + minutes;
  const minTimeInMinutes = 8 * 60; // 8:00 AM
  const maxTimeInMinutes = 18 * 60; // 6:00 PM
  return timeInMinutes >= minTimeInMinutes && timeInMinutes <= maxTimeInMinutes;
};

// Format date from YYYY-MM-DD to MM-DD-YYYY
export const formatDateForDisplay = (isoDate: string): string => {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${month}-${day}-${year}`;
};
