import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Capture a product photo for upload.
 *
 * The image is downscaled on the device before it is sent. A modern phone photo
 * is 3–6 MB raw, which becomes ~4–8 MB of base64 once JSON-encoded — larger than
 * the request size the web server will accept, so the upload would fail before
 * reaching the API. Shrinking first keeps a typical photo around 150–300 KB and
 * makes the failure mode something you can see instead of a 413.
 *
 * The server downscales again regardless. Belt and braces is warranted here
 * because a rejected upload is the single most common way this whole feature
 * breaks.
 */
const MAX_EDGE = 1400;
const COMPRESS = 0.7;

async function ensurePermission(request, message) {
  const { status, canAskAgain } = await request();
  if (status === 'granted') return true;
  if (!canAskAgain) {
    // Silently returning null here would look like the user cancelling. Say why.
    throw new Error(
      'permission-denied',
      message
    );
  }
  return null;
}

/**
 * @param {'camera'|'library'} source
 * @returns {Promise<{uri: string, base64: string, name: string}|null>}
 *   null when the user backs out. Throws with `code === 'permission-denied'`
 *   when the OS permission is refused.
 */
export async function captureProductImage(source = 'library') {
  const fromCamera = source === 'camera';

  const request = fromCamera
    ? ImagePicker.requestCameraPermissionsAsync
    : () => ImagePicker.requestMediaLibraryPermissionsAsync(false);

  const denied = await ensurePermission(
    request,
    fromCamera
      ? 'الكاميرا غير مسموحة. فعّلها من إعدادات الهاتف ثم أعد المحاولة.'
      : 'الوصول إلى الصور غير مسموح. فعّله من إعدادات الهاتف ثم أعد المحاولة.'
  );
  if (denied === null) return null; // prompt shown; user may still allow or refuse

  const options = {
    mediaTypes: ['images'],
    // Crop-to-square is wrong for a product photo — it silently cuts off parts of
    // the product, and there is no undo. Left off so the whole item is captured.
    allowsEditing: false,
    quality: 0.9,
  };

  const result = fromCamera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets || result.assets.length === 0) return null;

  const asset = result.assets[0];
  if (!asset || !asset.uri) return null;

  // Reject up front rather than uploading and failing on a server-side size
  // check after a slow round trip.
  if (asset.fileSize && asset.fileSize > 40 * 1024 * 1024) {
    throw new Error('too-large', 'الصورة كبيرة جداً. اختر صورة أصغر.');
  }

  const manipulated = await manipulateAsync(asset.uri, [{ resize: { width: MAX_EDGE } }], {
    compress: COMPRESS,
    format: SaveFormat.JPEG,
    base64: true,
  });

  if (!manipulated || !manipulated.base64) {
    throw new Error('no-base64', 'تعذر تجهيز الصورة للرفع.');
  }

  const originalName = asset.fileName || 'product.jpg';
  const name = originalName.toLowerCase().endsWith('.jpg') ? originalName : `${originalName}.jpg`;

  return {
    uri: manipulated.uri,
    // Raw base64: the API accepts it directly and detects a data URL if one is
    // ever added upstream.
    base64: manipulated.base64,
    name,
  };
}

export default captureProductImage;
