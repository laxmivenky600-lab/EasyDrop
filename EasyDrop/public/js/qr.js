
function generateQR(data, elementId) {
    const qr = qrcode(0, 'M');
    qr.addData(data);
    qr.make();
    document.getElementById(elementId).innerHTML = qr.createImgTag(5, 10);
}
