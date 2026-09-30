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

function permissionError(message, canAskAgain) {
  const error = new Error(message);
  // `new Error(msg, { code })` is the standard shape, but the code is attached
  // by hand so callers can tell a refusal from an unreachable module.
  error.code = canAskAgain ? 'permission-denied' : 'permission-blocked';
  return error;
}

async function ensurePermission(request, message) {
  const result = (await request()) || {};
  const status = result.status || (result.granted ? 'granted' : 'denied');
  if (status === 'granted') return true;

  // The request above already presented the system dialog and awaited the
  // answer, so "not granted" means the user actively refused (or the permission
  // is not declared in this build). Returning null here — to mean "a prompt was
  // shown, ask again later" — made the caller treat a refusal as "the user
  // backed out of the picker" and silently do nothing, which is why pressing
  // camera or gallery appeared to be a dead button.
  throw permissionError(message, result.canAskAgain);
}

/**
 * @param {'camera'|'library'} source
 * @returns {Promise<{uri: string, base64: string, name: string}|null>}
 *   null when the user backs out of the picker. Throws an Error whose `message`
 *   is already user-facing Arabic whenever the image cannot be obtained, with
 *   `code` set to one of `permission-denied`, `permission-blocked`, `too-large`
 *   or `no-base64`. Never returns null to mean a failure — a silent null here is
 *   indistinguishable from the user cancelling.
 */
export async function captureProductImage(source = 'library') {
  const fromCamera = source === 'camera';

  const request = fromCamera
    ? () => ImagePicker.requestCameraPermissionsAsync()
    : () => ImagePicker.requestMediaLibraryPermissionsAsync(false);

  await ensurePermission(
    request,
    fromCamera
      ? 'الكاميرا غير مسموحة. فعّلها من إعدادات الهاتف ثم أعد المحاولة.'
      : 'الوصول إلى الصور غير مسموح. فعّله من إعدادات الهاتف ثم أعد المحاولة.'
  );

  // A module missing from this build (a stale native build, or a platform with no
  // picker) would otherwise surface as "launchCameraAsync is not a function",
  // which says nothing useful about what to do next.
  const launcher = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  if (typeof launcher !== 'function') {
    throw new Error('التطبيق يحتاج إعادة بناء لتفعيل الكاميرا والمعرض. أعد البناء ثم أعد المحاولة.');
  }

  const options = {
    mediaTypes: ['images'],
    // Crop-to-square is wrong for a product photo — it silently cuts off parts of
    // the product, and there is no undo. Left off so the whole item is captured.
    allowsEditing: false,
    quality: 0.9,
  };

  const result = await launcher(options);

  if (result.canceled || !result.assets || result.assets.length === 0) return null;

  const asset = result.assets[0];
  if (!asset || !asset.uri) return null;

  // Reject up front rather than uploading and failing on a server-side size
  // check after a slow round trip.
  if (asset.fileSize && asset.fileSize > 40 * 1024 * 1024) {
    const error = new Error('الصورة كبيرة جداً. اختر صورة أصغر.');
    error.code = 'too-large';
    throw error;
  }

  const manipulated = await manipulateAsync(asset.uri, [{ resize: { width: MAX_EDGE } }], {
    compress: COMPRESS,
    format: SaveFormat.JPEG,
    base64: true,
  });

  if (!manipulated || !manipulated.base64) {
    const error = new Error('تعذر تجهيز الصورة للرفع.');
    error.code = 'no-base64';
    throw error;
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
