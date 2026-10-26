/**
 * Public contact details.
 *
 * Kept in one place because they are shown on the Contact screen, linked from
 * the website footer, and referenced by the policy pages. A phone number copied
 * into three files is a number that eventually disagrees with itself.
 */
export const CONTACT_PHONE_DISPLAY = '+967770785816';
export const CONTACT_PHONE_DIGITS = '967770785816';
export const CONTACT_EMAIL = 'shopzadmarket@gmail.com';

export const CONTACT_TEL_URL = `tel:${CONTACT_PHONE_DISPLAY}`;
export const CONTACT_MAILTO_URL = `mailto:${CONTACT_EMAIL}`;

/** Opens a WhatsApp chat with the store. Append `?text=` for a prefilled message. */
export const WHATSAPP_CHAT_URL = `https://wa.me/${CONTACT_PHONE_DIGITS}`;
