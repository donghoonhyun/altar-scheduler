/* eslint-disable @typescript-eslint/no-explicit-any */
import * as functions from 'firebase-functions/v1';
import { SolapiMessageService } from 'solapi';

/**
 * Sends a message using Solapi (formerly CoolSMS).
 * 
 * Configuration:
 * - solapi.api_key
 * - solapi.api_secret
 * - solapi.sender (Sender Phone Number)
 */
export const sendSolapiMessage = async (
  to: string,
  text: string
) => {
  const config = functions.config().solapi;

  if (!config || !config.api_key || !config.api_secret || !config.sender) {
    throw new Error('Solapi configuration missing. Set solapi.api_key, solapi.api_secret, and solapi.sender in functions config.');
  }

  const messageService = new SolapiMessageService(config.api_key, config.api_secret);

  try {
    const result = await messageService.send({
      to,
      from: config.sender,
      text,
    });
    
    console.log(`Solapi Send Success:`, result);
    return result;
  } catch (error: any) {
    console.error('Solapi Send Error:', error);
    // Solapi error object usually has error info
    throw new Error(`Solapi Error: ${error.message || JSON.stringify(error)}`);
  }
};
