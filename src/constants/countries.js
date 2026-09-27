/**
 * Country / dialling-code list used by the login and registration phone inputs.
 *
 * `code` is ISO 3166-1 alpha-2 and is only used to derive the flag emoji, so it
 * never has to be kept in sync with anything else. `dial` is the international
 * dialling prefix WITHOUT the `+` (the UI adds it).
 *
 * NOTE ON THE BACKEND CONTRACT
 * The Frappe endpoints this app talks to tie an account to a 9-digit national
 * number (`register_user_by_phone` does `phone[-9:]`) and log the user in as
 * `<national number>@yemen.local`. So Yemen is the default and the only country
 * that works end-to-end today. The full list is here so the picker is complete
 * and ready; switching the stored identity to E.164 is a backend change (see the
 * notes in the chat history) and needs no UI change afterwards.
 */

function flagFromCode(code) {
  // Regional indicator symbols: 'Y' -> U+1F1FF, 'E' -> U+1F1EA
  return String.fromCodePoint(
    ...String(code)
      .toUpperCase()
      .split('')
      .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65)
  );
}

export const COUNTRIES = [
  { code: 'YE', dial: '967', nameAr: 'اليمن', name: 'Yemen', min: 9 },
  { code: 'SA', dial: '966', nameAr: 'السعودية', name: 'Saudi Arabia' },
  { code: 'AE', dial: '971', nameAr: 'الإمارات', name: 'United Arab Emirates' },
  { code: 'OM', dial: '968', nameAr: 'عُمان', name: 'Oman' },
  { code: 'QA', dial: '974', nameAr: 'قطر', name: 'Qatar' },
  { code: 'KW', dial: '965', nameAr: 'الكويت', name: 'Kuwait' },
  { code: 'BH', dial: '973', nameAr: 'البحرين', name: 'Bahrain' },
  { code: 'JO', dial: '962', nameAr: 'الأردن', name: 'Jordan' },
  { code: 'PS', dial: '970', nameAr: 'فلسطين', name: 'Palestine' },
  { code: 'IQ', dial: '964', nameAr: 'العراق', name: 'Iraq' },
  { code: 'SY', dial: '963', nameAr: 'سوريا', name: 'Syria' },
  { code: 'LB', dial: '961', nameAr: 'لبنان', name: 'Lebanon' },
  { code: 'EG', dial: '20', nameAr: 'مصر', name: 'Egypt' },
  { code: 'LY', dial: '218', nameAr: 'ليبيا', name: 'Libya' },
  { code: 'TN', dial: '216', nameAr: 'تونس', name: 'Tunisia' },
  { code: 'DZ', dial: '213', nameAr: 'الجزائر', name: 'Algeria' },
  { code: 'MA', dial: '212', nameAr: 'المغرب', name: 'Morocco' },
  { code: 'MR', dial: '222', nameAr: 'موريتانيا', name: 'Mauritania' },
  { code: 'SD', dial: '249', nameAr: 'السودان', name: 'Sudan' },
  { code: 'SS', dial: '211', nameAr: 'جنوب السودان', name: 'South Sudan' },
  { code: 'SO', dial: '252', nameAr: 'الصومال', name: 'Somalia' },
  { code: 'DJ', dial: '253', nameAr: 'جيبوتي', name: 'Djibouti' },
  { code: 'ET', dial: '251', nameAr: 'إثيوبيا', name: 'Ethiopia' },
  { code: 'ER', dial: '291', nameAr: 'إريتريا', name: 'Eritrea' },
  { code: 'KM', dial: '269', nameAr: 'جزر القمر', name: 'Comoros' },
  { code: 'TR', dial: '90', nameAr: 'تركيا', name: 'Türkiye' },
  { code: 'IR', dial: '98', nameAr: 'إيران', name: 'Iran' },
  { code: 'AZ', dial: '994', nameAr: 'أذربيجان', name: 'Azerbaijan' },
  { code: 'GE', dial: '995', nameAr: 'جورجيا', name: 'Georgia' },
  { code: 'AM', dial: '374', nameAr: 'أرمينيا', name: 'Armenia' },
  { code: 'RU', dial: '7', nameAr: 'روسيا', name: 'Russia' },
  { code: 'UA', dial: '380', nameAr: 'أوكرانيا', name: 'Ukraine' },
  { code: 'PK', dial: '92', nameAr: 'باكستان', name: 'Pakistan' },
  { code: 'IN', dial: '91', nameAr: 'الهند', name: 'India' },
  { code: 'BD', dial: '880', nameAr: 'بنغلاديش', name: 'Bangladesh' },
  { code: 'LK', dial: '94', nameAr: 'سريلانكا', name: 'Sri Lanka' },
  { code: 'NP', dial: '977', nameAr: 'نيبال', name: 'Nepal' },
  { code: 'MV', dial: '960', nameAr: 'المالديف', name: 'Maldives' },
  { code: 'CN', dial: '86', nameAr: 'الصين', name: 'China' },
  { code: 'ID', dial: '62', nameAr: 'إندونيسيا', name: 'Indonesia' },
  { code: 'MY', dial: '60', nameAr: 'ماليزيا', name: 'Malaysia' },
  { code: 'SG', dial: '65', nameAr: 'سنغافورة', name: 'Singapore' },
  { code: 'TH', dial: '66', nameAr: 'تايلاند', name: 'Thailand' },
  { code: 'PH', dial: '63', nameAr: 'الفلبين', name: 'Philippines' },
  { code: 'VN', dial: '84', nameAr: 'فيتنام', name: 'Vietnam' },
  { code: 'MM', dial: '95', nameAr: 'ميانمار', name: 'Myanmar' },
  { code: 'KH', dial: '855', nameAr: 'كمبوديا', name: 'Cambodia' },
  { code: 'LA', dial: '856', nameAr: 'لاوس', name: 'Laos' },
  { code: 'BN', dial: '673', nameAr: 'بروناي', name: 'Brunei' },
  { code: 'US', dial: '1', nameAr: 'الولايات المتحدة', name: 'United States' },
  { code: 'CA', dial: '1', nameAr: 'كندا', name: 'Canada' },
  { code: 'GB', dial: '44', nameAr: 'المملكة المتحدة', name: 'United Kingdom' },
  { code: 'IE', dial: '353', nameAr: 'أيرلندا', name: 'Ireland' },
  { code: 'FR', dial: '33', nameAr: 'فرنسا', name: 'France' },
  { code: 'DE', dial: '49', nameAr: 'ألمانيا', name: 'Germany' },
  { code: 'NL', dial: '31', nameAr: 'هولندا', name: 'Netherlands' },
  { code: 'BE', dial: '32', nameAr: 'بلجيكا', name: 'Belgium' },
  { code: 'LU', dial: '352', nameAr: 'لوكسمبورغ', name: 'Luxembourg' },
  { code: 'CH', dial: '41', nameAr: 'سويسرا', name: 'Switzerland' },
  { code: 'AT', dial: '43', nameAr: 'النمسا', name: 'Austria' },
  { code: 'ES', dial: '34', nameAr: 'إسبانيا', name: 'Spain' },
  { code: 'PT', dial: '351', nameAr: 'البرتغال', name: 'Portugal' },
  { code: 'IT', dial: '39', nameAr: 'إيطاليا', name: 'Italy' },
  { code: 'GR', dial: '30', nameAr: 'اليونان', name: 'Greece' },
  { code: 'SE', dial: '46', nameAr: 'السويد', name: 'Sweden' },
  { code: 'NO', dial: '47', nameAr: 'النرويج', name: 'Norway' },
  { code: 'DK', dial: '45', nameAr: 'الدنمارك', name: 'Denmark' },
  { code: 'FI', dial: '358', nameAr: 'فنلندا', name: 'Finland' },
  { code: 'IS', dial: '354', nameAr: 'أيسلندا', name: 'Iceland' },
  { code: 'PL', dial: '48', nameAr: 'بولندا', name: 'Poland' },
  { code: 'CZ', dial: '420', nameAr: 'التشيك', name: 'Czechia' },
  { code: 'SK', dial: '421', nameAr: 'سلوفاكيا', name: 'Slovakia' },
  { code: 'HU', dial: '36', nameAr: 'المجر', name: 'Hungary' },
  { code: 'RO', dial: '40', nameAr: 'رومانيا', name: 'Romania' },
  { code: 'BG', dial: '359', nameAr: 'بلغاريا', name: 'Bulgaria' },
  { code: 'HR', dial: '385', nameAr: 'كرواتيا', name: 'Croatia' },
  { code: 'RS', dial: '381', nameAr: 'صربيا', name: 'Serbia' },
  { code: 'BA', dial: '387', nameAr: 'البوسنة والهرسك', name: 'Bosnia and Herzegovina' },
  { code: 'AL', dial: '355', nameAr: 'ألبانيا', name: 'Albania' },
  { code: 'ME', dial: '382', nameAr: 'الجبل الأسود', name: 'Montenegro' },
  { code: 'MK', dial: '389', nameAr: 'مقدونيا الشمالية', name: 'North Macedonia' },
  { code: 'XK', dial: '383', nameAr: 'كوسوفو', name: 'Kosovo' },
  { code: 'MD', dial: '373', nameAr: 'مولدوفا', name: 'Moldova' },
  { code: 'BR', dial: '55', nameAr: 'البرازيل', name: 'Brazil' },
  { code: 'AR', dial: '54', nameAr: 'الأرجنتين', name: 'Argentina' },
  { code: 'CL', dial: '56', nameAr: 'تشيلي', name: 'Chile' },
  { code: 'CO', dial: '57', nameAr: 'كولومبيا', name: 'Colombia' },
  { code: 'PE', dial: '51', nameAr: 'بيرو', name: 'Peru' },
  { code: 'VE', dial: '58', nameAr: 'فنزويلا', name: 'Venezuela' },
  { code: 'EC', dial: '593', nameAr: 'الإكوادور', name: 'Ecuador' },
  { code: 'BO', dial: '591', nameAr: 'بوليفيا', name: 'Bolivia' },
  { code: 'UY', dial: '598', nameAr: 'أوروغواي', name: 'Uruguay' },
  { code: 'PY', dial: '595', nameAr: 'باراغواي', name: 'Paraguay' },
  { code: 'CU', dial: '53', nameAr: 'كوبا', name: 'Cuba' },
  { code: 'ZA', dial: '27', nameAr: 'جنوب أفريقيا', name: 'South Africa' },
  { code: 'NG', dial: '234', nameAr: 'نيجيريا', name: 'Nigeria' },
  { code: 'KE', dial: '254', nameAr: 'كينيا', name: 'Kenya' },
  { code: 'GH', dial: '233', nameAr: 'غانا', name: 'Ghana' },
  { code: 'TZ', dial: '255', nameAr: 'تنزانيا', name: 'Tanzania' },
  { code: 'UG', dial: '256', nameAr: 'أوغندا', name: 'Uganda' },
  { code: 'ZW', dial: '263', nameAr: 'زيمبابوي', name: 'Zimbabwe' },
  { code: 'ZM', dial: '260', nameAr: 'زامبيا', name: 'Zambia' },
  { code: 'AO', dial: '244', nameAr: 'أنغولا', name: 'Angola' },
  { code: 'MU', dial: '230', nameAr: 'موريشيوس', name: 'Mauritius' },
  { code: 'MG', dial: '261', nameAr: 'مدغشقر', name: 'Madagascar' },
  { code: 'SN', dial: '221', nameAr: 'السنغال', name: 'Senegal' },
  { code: 'CI', dial: '225', nameAr: 'ساحل العاج', name: "Côte d'Ivoire" },
  { code: 'ML', dial: '223', nameAr: 'مالي', name: 'Mali' },
  { code: 'BF', dial: '226', nameAr: 'بوركينا فاسو', name: 'Burkina Faso' },
  { code: 'NE', dial: '227', nameAr: 'النيجر', name: 'Niger' },
  { code: 'TD', dial: '235', nameAr: 'تشاد', name: 'Chad' },
  { code: 'GN', dial: '224', nameAr: 'غينيا', name: 'Guinea' },
  { code: 'MZ', dial: '258', nameAr: 'موزمبيق', name: 'Mozambique' },
  { code: 'NC', dial: '687', nameAr: 'كاليدونيا الجديدة', name: 'New Caledonia' },
  { code: 'PF', dial: '689', nameAr: 'بولينزيا الفرنسية', name: 'French Polynesia' },
  { code: 'GL', dial: '299', nameAr: 'غرينلاند', name: 'Greenland' },
  { code: 'FO', dial: '298', nameAr: 'جزر فارو', name: 'Faroe Islands' },
  { code: 'GI', dial: '350', nameAr: 'جبل طارق', name: 'Gibraltar' },
  { code: 'IM', dial: '44', nameAr: 'جزيرة مان', name: 'Isle of Man' },
  { code: 'JE', dial: '44', nameAr: 'جيرزي', name: 'Jersey' },
  { code: 'GG', dial: '44', nameAr: 'غيرنزي', name: 'Guernsey' },
  { code: 'PR', dial: '1', nameAr: 'بورتوريكو', name: 'Puerto Rico' },
  { code: 'BM', dial: '1', nameAr: 'برمودا', name: 'Bermuda' },
];

// Pre-compute the flag once per entry so the list rows stay cheap to render.
COUNTRIES.forEach((country) => {
  country.flag = flagFromCode(country.code);
});

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Yemen

/**
 * Minimum number of national digits we accept for a country. Only Yemen carries
 * an explicit `min` because it is the one the backend still validates at 9
 * digits; everything else falls back to a permissive 6.
 */
export function minDigitsFor(country) {
  return (country && country.min) || 6;
}

/** Longest national number we accept (E.164 caps the significant part at 15). */
export const MAX_DIGITS = 15;

/** Combine a country and a national number into an E.164-ish string. */
export function toFullPhone(country, nationalNumber) {
  const digits = String(nationalNumber || '').replace(/[^0-9]/g, '');
  if (!country || !digits) return '';
  return `+${country.dial}${digits}`;
}

/**
 * The same combination as {@link toFullPhone} but digits only, no `+` — this is
 * the single identity value sent to the server (`967771234567`).
 */
export function toCombinedDigits(country, nationalNumber) {
  return toFullPhone(country, nationalNumber).replace(/^\+/, '');
}

/**
 * Filter the list by Arabic name, English name, dialling code or flag. Empty
 * search terms return everything.
 */
export function searchCountries(list, term) {
  const q = String(term || '').trim().toLowerCase();
  if (!q) return list;
  const digitsOnly = q.replace(/[^0-9]/g, '');
  return list.filter((country) => {
    if (country.dial.includes(digitsOnly) && digitsOnly) return true;
    return (
      country.nameAr.includes(q) ||
      country.name.toLowerCase().includes(q) ||
      country.dial.includes(q)
    );
  });
}

export default COUNTRIES;
