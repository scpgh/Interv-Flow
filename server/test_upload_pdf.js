import fs from 'fs';

try {
  const fileBuffer = fs.readFileSync('./test.pdf');
  
  // We can construct a multipart form-data request manually
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  let body = '';
  
  // domain field
  body += `--${boundary}\r\n`;
  body += 'Content-Disposition: form-data; name="domain"\r\n\r\n';
  body += 'swe\r\n';
  
  // resume file field
  body += `--${boundary}\r\n`;
  body += 'Content-Disposition: form-data; name="resume"; filename="test.pdf"\r\n';
  body += 'Content-Type: application/pdf\r\n\r\n';
  
  const headerBuffer = Buffer.from(body, 'utf-8');
  const footerBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  
  const multipartBody = Buffer.concat([headerBuffer, fileBuffer, footerBuffer]);
  
  const response = await fetch('http://localhost:5000/api/analyze-resume', {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': multipartBody.length
    },
    body: multipartBody
  });
  
  console.log("Status:", response.status);
  const json = await response.json();
  console.log("Response JSON:", JSON.stringify(json, null, 2));
} catch (err) {
  console.error("Upload test failed:", err);
}
