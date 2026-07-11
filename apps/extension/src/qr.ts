import qrcode from "qrcode-generator";

/** Encode `text` as a QR code and return a GIF data URL, generated locally (no network).
 *  Used by the popup to render the iPhone pairing URL. */
export function qrDataUrl(text:string,cellSize=4,margin=2):string{
  const qr=qrcode(0,"M");
  qr.addData(text);
  qr.make();
  return qr.createDataURL(cellSize,margin);
}
