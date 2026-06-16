import pdfParse from 'pdf-parse';
import fs from 'fs';

try {
  const buffer = fs.readFileSync('./test.pdf');
  console.log("Reading test.pdf, buffer length:", buffer.length);
  const data = await pdfParse(buffer);
  console.log("PDF parsed successfully!");
  console.log("Metadata:", data.info);
  console.log("Text length:", data.text.length);
  console.log("Sample text:\n", data.text.substring(0, 200));
} catch (err) {
  console.error("PDF Parsing error:", err);
}
