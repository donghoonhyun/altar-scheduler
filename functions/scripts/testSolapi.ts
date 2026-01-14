/* eslint-disable @typescript-eslint/no-explicit-any */
import { SolapiMessageService } from 'solapi';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  try {
    // 1. Read .runtimeconfig.json
    const configPath = path.resolve(__dirname, '../.runtimeconfig.json');
    if (!fs.existsSync(configPath)) {
      console.error('❌ .runtimeconfig.json not found');
      return;
    }
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    const apiKey = config.solapi?.api_key || 'NCSGDXUJAZFWJOA3';
    const apiSecret = config.solapi?.api_secret || '0VRAXA4UP1IIWLGCKARGNB0YYJDFF0UX';
    const sender = config.solapi?.sender || '01020879969';
    const receiver = '01020879969'; // Your own number for testing

    console.log('Testing Solapi with:');
    console.log(`- API Key: ${apiKey}`);
    console.log(`- Sender: ${sender}`);
    console.log(`- Receiver: ${receiver}`);

    // 2. Initialize Service
    const messageService = new SolapiMessageService(apiKey, apiSecret);

    // 3. Send Message
    console.log('🚀 Sending message...');
    const result = await messageService.send({
      to: receiver,
      from: sender,
      text: '[Test] Solapi direct test script works!'
    });

    console.log('✅ Success:', result);

  } catch (error: any) {
    console.error('❌ Error:', error);
  }
}

main();
