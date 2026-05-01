import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class KredpoolService {
  private readonly logger = new Logger(KredpoolService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('KREDPOOL_API');
    this.apiKey = this.configService.get<string>('KREDPOOL_API_KEY');

    if (!this.baseUrl || !this.apiKey) {
      this.logger.warn('KREDPOOL_API or KREDPOOL_API_KEY not set in environment');
    }
  }

  async verifyPan(panNo: string) {
    try {
      const url = `${this.baseUrl}/verify/pan`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({ pan_no: panNo }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Kredpool PAN Verify failed: ${response.status} - ${errorText}`);
        throw new BadRequestException('PAN verification failed at provider');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      this.logger.error(`Error in verifyPan: ${error.message}`);
      throw error;
    }
  }

  async sendAadhaarOtp(aadhaarNo: string) {
    try {
      const url = `${this.baseUrl}/verify/aadhaar/otp`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({ aadhaar_no: aadhaarNo }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Kredpool Aadhaar OTP failed: ${response.status} - ${errorText}`);
        throw new BadRequestException('Failed to send Aadhaar OTP');
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Error in sendAadhaarOtp: ${error.message}`);
      throw error;
    }
  }

  async verifyAadhaarData(clientId: string, otp: string, aadhaarNo: string) {
    try {
      const url = `${this.baseUrl}/verify/aadhaar/data`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({ client_id: clientId, otp, aadhaar_no: aadhaarNo }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Kredpool Aadhaar Data Verify failed: ${response.status} - ${errorText}`);
        throw new BadRequestException('Aadhaar OTP verification failed');
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Error in verifyAadhaarData: ${error.message}`);
      throw error;
    }
  }

  async performPanOcr(filePath: string, fileName: string, mimeType: string) {
    try {
      const url = `${this.baseUrl}/ocr/pan`;
      const formData = new FormData();
      
      const fileBuffer = fs.readFileSync(path.join(process.cwd(), filePath));
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append('files', blob, fileName);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Kredpool PAN OCR failed: ${response.status} - ${errorText}`);
        return null; // Fallback to mock or manual entry
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Error in performPanOcr: ${error.message}`);
      return null;
    }
  }

  async performAadhaarOcr(filePath: string, fileName: string, mimeType: string) {
    try {
      const url = `${this.baseUrl}/ocr/adhaar`; // Spelling as per user request
      const formData = new FormData();
      
      const fileBuffer = fs.readFileSync(path.join(process.cwd(), filePath));
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append('files', blob, fileName);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Kredpool Aadhaar OCR failed: ${response.status} - ${errorText}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Error in performAadhaarOcr: ${error.message}`);
      return null;
    }
  }
}
