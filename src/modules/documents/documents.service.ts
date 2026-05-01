import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly tempDir = path.join(process.cwd(), 'uploads', 'temp');
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'documents');

  constructor(private readonly db: DatabaseService) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async getMasterDocuments(entityType: string) {
    const query = `
      SELECT * FROM document_master 
      WHERE is_active = TRUE 
      AND (entity_type = 'A' OR entity_type = $1)
      ORDER BY sort_order ASC
    `;
    const res = await this.db.query(query, [entityType]);
    return res.rows;
  }

  async getProposalDocuments(proposalId: string, entityType?: string, participantId?: string) {
    let query = `
      SELECT pd.*, dm.doc_name as master_doc_name
      FROM proposal_documents pd
      LEFT JOIN document_master dm ON pd.document_master_id = dm.id
      WHERE pd.proposal_id = $1
    `;
    const params: any[] = [proposalId];

    if (entityType) {
      query += ` AND pd.entity_type = $${params.length + 1}`;
      params.push(entityType);
    }

    if (participantId) {
      query += ` AND pd.participant_id = $${params.length + 1}`;
      params.push(participantId);
    } else if (entityType === 'B') {
      query += ` AND pd.participant_id IS NULL`;
    }

    query += ` ORDER BY pd.created_at DESC`;

    const res = await this.db.query(query, params);
    return res.rows;
  }

  async saveDocumentMetadata(data: {
    proposal_id: string;
    document_master_id?: number;
    custom_doc_name?: string;
    entity_type: string;
    participant_id?: string;
    file_name: string;
    stored_name: string;
    file_path: string;
    mime_type: string;
    file_size: number;
    structured_ocr_data?: any;
  }) {
    const query = `
      INSERT INTO proposal_documents (
        proposal_id, document_master_id, custom_doc_name, entity_type, participant_id,
        file_name, stored_name, file_path, mime_type, file_size, structured_ocr_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const params = [
      data.proposal_id,
      data.document_master_id || null,
      data.custom_doc_name || null,
      data.entity_type,
      data.participant_id || null,
      data.file_name,
      data.stored_name,
      data.file_path,
      data.mime_type,
      data.file_size,
      data.structured_ocr_data || null
    ];
    const res = await this.db.query(query, params);
    return res.rows[0];
  }

  async deleteDocument(id: string) {
    const doc = await this.db.findOne('SELECT * FROM proposal_documents WHERE id = $1', [id]);
    if (!doc) throw new NotFoundException('Document not found');

    // Delete from DB
    await this.db.query('DELETE FROM proposal_documents WHERE id = $1', [id]);

    // Delete from File System
    const absolutePath = path.join(process.cwd(), doc.file_path);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    return { message: 'Document deleted successfully' };
  }

  async getDocumentFile(id: string) {
    const doc = await this.db.findOne('SELECT * FROM proposal_documents WHERE id = $1', [id]);
    if (!doc) throw new NotFoundException('Document not found');

    const absolutePath = path.join(process.cwd(), doc.file_path);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('File not found on disk');
    }

    return {
      path: absolutePath,
      mimeType: doc.mime_type,
      fileName: doc.file_name
    };
  }

  async updateOcrData(id: string, ocrData: any) {
    const query = `
      UPDATE proposal_documents 
      SET structured_ocr_data = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const res = await this.db.query(query, [ocrData, id]);
    if (res.rowCount === 0) throw new NotFoundException('Document not found');
    return res.rows[0];
  }

  async saveTemporaryDocument(data: {
    tempId: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    docType?: string;
    ocrData?: any;
  }) {
    const query = `
      INSERT INTO temporary_documents (
        id, file_name, stored_name, file_path, mime_type, file_size, structured_ocr_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const params = [
      data.tempId, // UUID-like string from uuidv4
      data.fileName,
      data.tempId, // stored_name
      data.filePath,
      data.mimeType,
      data.fileSize,
      data.ocrData || null
    ];
    const res = await this.db.query(query, params);
    return res.rows[0];
  }

  async commitTemporaryDocument(tempId: string, proposalId: string, entityType: string, participantId?: string, customDocName?: string) {
    const tempDoc = await this.db.findOne('SELECT * FROM temporary_documents WHERE id = $1', [tempId]);
    if (!tempDoc) throw new NotFoundException('Temporary document not found');

    const oldPath = path.join(process.cwd(), tempDoc.file_path);
    const newStoredName = `${tempDoc.stored_name}`; // Keep same or change
    const newRelativePath = `uploads/documents/${newStoredName}`;
    const newPath = path.join(process.cwd(), newRelativePath);

    // Move file
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }

    // Save to permanent
    const query = `
      INSERT INTO proposal_documents (
        proposal_id, custom_doc_name, entity_type, participant_id,
        file_name, stored_name, file_path, mime_type, file_size, structured_ocr_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const params = [
      proposalId,
      customDocName || tempDoc.file_name,
      entityType,
      participantId || null,
      tempDoc.file_name,
      tempDoc.stored_name,
      newRelativePath,
      tempDoc.mime_type,
      tempDoc.file_size,
      tempDoc.structured_ocr_data
    ];
    
    const res = await this.db.query(query, params);

    // Delete from temp table
    await this.db.query('DELETE FROM temporary_documents WHERE id = $1', [tempId]);

    return res.rows[0];
  }

  async saveVerificationMetadata(data: {
    proposalId: string;
    entityType: string;
    customDocName: string;
    structuredOcrData: any;
  }) {
    const query = `
      INSERT INTO proposal_documents (
        proposal_id, custom_doc_name, entity_type,
        file_name, stored_name, file_path, structured_ocr_data, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const params = [
      data.proposalId,
      data.customDocName,
      data.entityType,
      'VERIFICATION_RESULT', // dummy name
      'VERIFICATION_RESULT', // dummy name
      'N/A',                 // dummy path
      data.structuredOcrData,
      'verified'
    ];
    const res = await this.db.query(query, params);
    return res.rows[0];
  }
}
