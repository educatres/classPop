export function renderQr(container, text, label = 'QR Code') {
  container.replaceChildren();

  if (!text) return;

  if (window.QRCode) {
    new window.QRCode(container, {
      text,
      width: 220,
      height: 220,
      colorDark: '#172033',
      colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.M,
    });
    return;
  }

  const image = document.createElement('img');
  image.width = 220;
  image.height = 220;
  image.alt = label;
  const url = new URL('https://api.qrserver.com/v1/create-qr-code/');
  url.searchParams.set('size', '220x220');
  url.searchParams.set('margin', '12');
  url.searchParams.set('data', text);
  image.src = url.toString();
  container.append(image);
}
