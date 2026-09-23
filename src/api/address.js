import { frappeCall } from './client';

export const AddressAPI = {
  /**
   * Get list of addresses for current customer
   */
  getAddresses() {
    return frappeCall('ecommerce.api.addresses', {}, 'GET');
  },

  /**
   * Add new customer shipping address
   */
  addAddress({ addressLine1, phone, city = 'مأرب', addressTitle = '' }) {
    const args = {
      address_line1: addressLine1,
      phone: phone || '',
      city: city || 'مأرب',
      address_title: addressTitle || 'عنوان التوصيل',
    };
    return frappeCall('ecommerce.api.add_address', args, 'POST');
  },
};

export default AddressAPI;