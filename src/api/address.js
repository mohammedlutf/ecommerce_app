import { frappeCall } from './client';
import { formatCoords, isValidCoords } from '../utils/geo';

/**
 * The map pin is persisted in `address_line2` as "lat,lng" and the readable
 * place name in `pincode`, so the two travel together in one payload. They are
 * built here rather than in the form so a malformed coordinate can never reach
 * the server.
 */
function buildAddressArgs({
  addressTitle,
  addressLine1,
  city,
  phone,
  coords,
  placeName,
  isDefault = false,
}) {
  const args = {};

  if (addressTitle !== undefined) args.address_title = addressTitle || 'عنوان التوصيل';
  if (addressLine1 !== undefined) args.address_line1 = (addressLine1 || '').trim();
  if (city !== undefined) args.city = city || '';
  if (phone !== undefined) args.phone = (phone || '').trim();

  // An unpin valid coordinate would put the delivery at 0,0, so the pin is only
  // sent when it is actually valid. A broken one is omitted rather than sent as
  // an empty string, which would silently erase the pin an existing address
  // already has. `placeName` is different: clearing it is meaningful, because a
  // pin that moved somewhere the geocoder cannot name must not keep showing the
  // old neighbourhood's name.
  if (isValidCoords(coords)) {
    args.address_line2 = formatCoords(coords);
  }
  if (placeName !== undefined) args.pincode = placeName || '';

  if (isDefault) args.is_default_address = 1;

  return args;
}

export const AddressAPI = {
  /**
   * Get list of addresses for current customer
   */
  getAddresses() {
    return frappeCall('webshop.my_api.api.addresses', {}, 'GET');
  },

  /**
   * Add new customer shipping address.
   *
   * `phone` (رقم هاتف المستلم) is optional: leave it empty and the server falls
   * back to the customer's own number, so a shopper who is ordering for
   * themselves does not have to retype their phone.
   *
   * @param {Object} params
   * @param {string} [params.addressTitle]
   * @param {string} params.addressLine1
   * @param {string} [params.city]
   * @param {string} [params.phone]
   * @param {{latitude: number, longitude: number}} [params.coords] map pin
   * @param {string} [params.placeName] readable name for the pin
   * @param {boolean} [params.isDefault]
   */
  async addAddress({ addressTitle, addressLine1, city, phone, coords, placeName, isDefault } = {}) {
    const args = buildAddressArgs({
      addressTitle: addressTitle ?? 'عنوان التوصيل',
      addressLine1,
      city,
      phone,
      coords,
      placeName,
      isDefault,
    });
    return frappeCall('webshop.my_api.api.add_address', args, 'POST');
  },

  /**
   * Update an existing address.
   *
   * Same payload as `addAddress` plus the address name. Fields left undefined
   * are not sent at all, so a partial edit cannot blank a column the user never
   * touched.
   *
   * @param {Object} params
   * @param {string} params.addressName the Address document name
   */
  async updateAddress({ addressName, addressTitle, addressLine1, city, phone, coords, placeName, isDefault } = {}) {
    if (!addressName) throw new Error('معرف العنوان مفقود');
    const args = { address_name: addressName };
    Object.assign(
      args,
      buildAddressArgs({ addressTitle, addressLine1, city, phone, coords, placeName, isDefault })
    );
    return frappeCall('webshop.my_api.api.update_address', args, 'POST');
  },

  /**
   * Delete one of the customer's addresses.
   *
   * @param {string} addressName the Address document name
   */
  async deleteAddress(addressName) {
    if (!addressName) throw new Error('معرف العنوان مفقود');
    return frappeCall('webshop.my_api.api.delete_address', { address_name: addressName }, 'POST');
  },

  /**
   * Mark an address as the customer's default.
   *
   * @param {string} addressName
   */
  async setDefaultAddress(addressName) {
    if (!addressName) throw new Error('معرف العنوان مفقود');
    return frappeCall('webshop.my_api.api.set_default_address', { address_name: addressName }, 'POST');
  },

};

export default AddressAPI;
