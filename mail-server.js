const http = require('http');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.163.com',
  port: 465,
  secure: true,
  auth: { user: '16690511701@163.com', pass: 'KVcKq32R3cHAYAqq' }
});

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.url === '/api/send-code' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { email } = JSON.parse(body);
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await transporter.sendMail({
          from: '"AI Hub" <16690511701@163.com>',
          to: email,
          subject: 'AI Hub 验证码',
          text: '您的验证码是: ' + code + '，5分钟内有效。',
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '验证码已发送', code: code }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '邮件发送失败: ' + e.message }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(3456, () => console.log('Mail server running on http://localhost:3456'));
