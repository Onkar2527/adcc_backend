import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
  Res, Req, BadRequestException
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { KredpoolService } from '../kredpool/kredpool.service';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { pipeline } from 'stream/promises';
import type { FastifyRequest, FastifyReply } from 'fastify';

// This import is required to augment FastifyRequest with multipart methods like .file()
import '@fastify/multipart';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly kredpoolService: KredpoolService
  ) { }

  @Get('master')
  async getMaster(@Query('entityType') entityType: string) {
    const data = await this.documentsService.getMasterDocuments(entityType || 'A');
    return { data };
  }

  @Get('proposal/:proposalId')
  async getByProposal(
    @Param('proposalId') proposalId: string,
    @Query('entityType') entityType?: string,
    @Query('participantId') participantId?: string
  ) {
    const data = await this.documentsService.getProposalDocuments(proposalId, entityType, participantId);
    return { data };
  }

  @Post('upload')
  async uploadFile(@Req() req: FastifyRequest) {
    // req.file() automatically handles fields sent BEFORE the file
    const part = await req.file();
    
    if (!part) {
      throw new BadRequestException('No file uploaded');
    }

    // Extract fields from the part
    const fields: any = {};
    for (const key in part.fields) {
      // @ts-ignore
      fields[key] = part.fields[key].value;
    }

    // Validate required fields
    if (!fields.proposalId) {
      throw new BadRequestException('proposalId is required and must be sent before the file');
    }
    if (!fields.entityType) {
      throw new BadRequestException('entityType is required and must be sent before the file');
    }

    const storedName = `${uuidv4()}${path.extname(part.filename)}`;
    const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
    const filePath = path.join(uploadDir, storedName);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Save file stream to disk
    try {
      await pipeline(part.file, fs.createWriteStream(filePath));
    } catch (err) {
      throw new BadRequestException('File streaming failed: ' + err.message);
    }

    // Save metadata
    const data = await this.documentsService.saveDocumentMetadata({
      proposal_id: fields.proposalId,
      entity_type: fields.entityType,
      document_master_id: fields.documentMasterId ? parseInt(fields.documentMasterId) : undefined,
      custom_doc_name: fields.customDocName,
      participant_id: fields.participantId,
      file_name: part.filename,
      stored_name: storedName,
      file_path: `uploads/documents/${storedName}`,
      mime_type: part.mimetype,
      file_size: 0,
      structured_ocr_data: fields.structuredOcrData ? JSON.parse(fields.structuredOcrData) : undefined
    });

    return { data, message: 'File uploaded successfully' };
  }

  @Get('view/:id')
  async viewFile(@Param('id') id: string, @Res() res: FastifyReply) {
    const fileInfo = await this.documentsService.getDocumentFile(id);
    const stream = fs.createReadStream(fileInfo.path);

    res.header('Content-Type', fileInfo.mimeType);
    res.header('Content-Disposition', `inline; filename="${fileInfo.fileName}"`);
    return res.send(stream);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return await this.documentsService.deleteDocument(id);
  }

  @Patch(':id/ocr')
  async updateOcr(@Param('id') id: string, @Body('ocrData') ocrData: any) {
    const data = await this.documentsService.updateOcrData(id, ocrData);
    return { data, message: 'OCR data updated successfully' };
  }

  @Post('temp-upload')
  async uploadTempFile(@Req() req: FastifyRequest) {
    const part = await req.file();
    if (!part) throw new BadRequestException('No file uploaded');

    const tempId = uuidv4();
    const storedName = `${tempId}${path.extname(part.filename)}`;
    const tempDir = path.join(process.cwd(), 'uploads', 'temp');
    const filePath = path.join(tempDir, storedName);

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Save file stream to disk
    try {
      await pipeline(part.file, fs.createWriteStream(filePath));
    } catch (err) {
      throw new BadRequestException('File streaming failed: ' + err.message);
    }

    // Extract fields
    const fields: any = {};
    for (const key in part.fields) {
      // @ts-ignore
      fields[key] = part.fields[key].value;
    }

    const docType = fields.docType;

    // OCR Logic
    let ocrData: any = null;
    if (docType === 'PAN') {
      const relativePath = path.join('uploads', 'temp', storedName);
      ocrData = await this.kredpoolService.performPanOcr(relativePath, part.filename, part.mimetype);
      
      // Fallback if OCR fails
      if (!ocrData) {
        ocrData = { 
          applicantName: 'OCR FAILED',
          panNumber: '',
          dob: null
        };
      } else {
        // Map Kredpool response to our expected format if needed
        // Response: { "name": "...", "pan": "...", "dob": "..." }
        ocrData = {
          applicantName: ocrData.name,
          panNumber: ocrData.pan,
          dob: ocrData.dob // Keep as string or parse if needed
        };
      }
    } else if (docType === 'AADHAAR') {
      const relativePath = path.join('uploads', 'temp', storedName);
      ocrData = await this.kredpoolService.performAadhaarOcr(relativePath, part.filename, part.mimetype);
      
      if (!ocrData) {
        ocrData = { 
          applicantName: 'OCR FAILED',
          aadhaarNumber: '',
          dob: null,
          gender: null
        };
      } else {
        // Map Kredpool Aadhaar response
        // Response: { "name": "...", "dob": "...", "gender": "MALE", "aadhaar": "...", "address": "..." }
        let mappedGender = null;
        if (ocrData.gender) {
          const g = ocrData.gender.toUpperCase();
          if (g === 'MALE') mappedGender = 'M';
          else if (g === 'FEMALE') mappedGender = 'F';
        }

        ocrData = {
          applicantName: ocrData.name,
          aadhaarNumber: ocrData.aadhaar,
          dob: ocrData.dob,
          gender: mappedGender
        };
      }
    }

    const tempDoc = await this.documentsService.saveTemporaryDocument({
      tempId,
      fileName: part.filename,
      filePath: path.join('uploads', 'temp', storedName),
      mimeType: part.mimetype,
      fileSize: 0, // Fastify-multipart doesn't give size easily without reading buffer, 0 is fine for temp
      docType,
      ocrData
    });

    return { 
      data: tempDoc, 
      ocrData,
      message: 'File uploaded and OCR processed' 
    };
  }

  @Post('temp-commit')
  async commitTempFile(@Body() body: { tempId: string, proposalId: string, entityType: string, participantId?: string, customDocName?: string }) {
    const data = await this.documentsService.commitTemporaryDocument(
      body.tempId, body.proposalId, body.entityType, body.participantId, body.customDocName
    );
    return { data, message: 'Document committed successfully' };
  }

  @Post('verification')
  async saveVerification(@Body() body: any) {
    const data = await this.documentsService.saveVerificationMetadata(body);
    return { data, message: 'Verification data saved successfully' };
  }
}
