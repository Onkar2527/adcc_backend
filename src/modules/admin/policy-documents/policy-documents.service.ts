import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../../core/database/database.service';
import { CreatePolicyDocumentDto, UpdatePolicyDocumentDto } from './dto/policy-document.dto';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class PolicyDocumentsService {
  constructor(private readonly db: DatabaseService) {}

  private async queryRows(query: string, params: any[] = []) {
    const result = await this.db.query(query, params);
    return result.rows;
  }

  private async queryOne(query: string, params: any[] = []) {
    const rows = await this.queryRows(query, params);
    return rows[0];
  }

  private getStoragePath(filename: string) {
    const dir = path.join(process.cwd(), 'uploads', 'policy-documents');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, path.basename(filename));
  }

  async validateDuplicateCode(documentCode: string, excludeId?: number) {
    let query = `
      SELECT id 
      FROM policy_documents 
      WHERE UPPER(document_code) = UPPER($1) 
        AND deleted_at IS NULL
    `;
    const params: any[] = [documentCode];

    if (excludeId) {
      query += ` AND id != $2`;
      params.push(excludeId);
    }

    const row = await this.queryOne(query, params);
    if (row) {
      throw new BadRequestException('Document code already exists');
    }
  }

  async findAll() {
    try {
      return this.queryRows(`
        SELECT 
          pd.*,
          em.name AS uploaded_by_name
        FROM policy_documents pd
        LEFT JOIN employee_master em ON em.id = pd.uploaded_by
        WHERE pd.deleted_at IS NULL
        ORDER BY pd.id DESC
      `);
    } catch (error) {
      throw new BadRequestException('Failed to fetch policy documents');
    }
  }

  async findOne(id: number) {
    const row = await this.queryOne(`
      SELECT 
        pd.*,
        em.name AS uploaded_by_name
      FROM policy_documents pd
      LEFT JOIN employee_master em ON em.id = pd.uploaded_by
      WHERE pd.id = $1 AND pd.deleted_at IS NULL
    `, [id]);

    if (!row) {
      throw new NotFoundException('Policy document not found');
    }

    return row;
  }

  async generateNextDocumentCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `POL-${year}-`;
    const lastDoc = await this.queryOne(
      `SELECT document_code 
       FROM policy_documents 
       WHERE document_code LIKE $1 
       ORDER BY id DESC 
       LIMIT 1`,
      [`${prefix}%`]
    );

    if (lastDoc && lastDoc.document_code) {
      const parts = lastDoc.document_code.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        const nextSeq = (lastSeq + 1).toString().padStart(3, '0');
        return `${prefix}${nextSeq}`;
      }
    }

    return `${prefix}001`;
  }

  async create(
    data: CreatePolicyDocumentDto,
    file?: { filename: string; mimetype: string; buffer: Buffer },
  ) {
    const docCode = data.document_code && data.document_code !== 'Auto-generated' && data.document_code !== 'Loading...'
      ? data.document_code
      : await this.generateNextDocumentCode();

    await this.validateDuplicateCode(docCode);

    let uploadedFilePath = '';
    if (file) {
      const extension = path.extname(file.filename);
      const storedName = `${randomUUID()}${extension}`;
      const storagePath = this.getStoragePath(storedName);
      fs.writeFileSync(storagePath, file.buffer);
      // We will store the relative or clean file path
      uploadedFilePath = storedName;
    }

    try {
      const row = await this.queryOne(`
        INSERT INTO policy_documents (
          document_code,
          document_title,
          department,
          description,
          version_no,
          issue_date,
          effective_date,
          review_date,
          expiry_date,
          uploaded_file_path,
          uploaded_by,
          approved_by,
          approved_date,
          certified_authority,
          certified_date,
          certification_remarks,
          user_access,
          is_active
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        )
        RETURNING *
      `, [
        docCode,
        data.document_title.trim(),
        data.department ?? null,
        data.description ?? null,
        data.version_no.trim(),
        data.issue_date ? new Date(data.issue_date) : null,
        data.effective_date ? new Date(data.effective_date) : null,
        data.review_date ? new Date(data.review_date) : null,
        data.expiry_date ? new Date(data.expiry_date) : null,
        uploadedFilePath || null,
        data.uploaded_by ?? null,
        data.approved_by ?? null,
        data.approved_date ? new Date(data.approved_date) : null,
        data.certified_authority ?? null,
        data.certified_date ? new Date(data.certified_date) : null,
        data.certification_remarks ?? null,
        data.user_access ?? '',
        data.is_active ?? 1
      ]);

      return row;
    } catch (error) {
      if (uploadedFilePath) {
        const pathToDelete = this.getStoragePath(uploadedFilePath);
        if (fs.existsSync(pathToDelete)) {
          fs.unlinkSync(pathToDelete);
        }
      }
      throw error;
    }
  }

  async update(
    id: number,
    data: UpdatePolicyDocumentDto,
    file?: { filename: string; mimetype: string; buffer: Buffer },
  ) {
    const existing = await this.findOne(id);

    const docCode = data.document_code ?? existing.document_code;
    await this.validateDuplicateCode(docCode, id);

    let uploadedFilePath = existing.uploaded_file_path;
    if (file) {
      // Write new file
      const extension = path.extname(file.filename);
      const storedName = `${randomUUID()}${extension}`;
      const storagePath = this.getStoragePath(storedName);
      fs.writeFileSync(storagePath, file.buffer);

      // Delete old file if existed
      if (existing.uploaded_file_path) {
        const oldPath = this.getStoragePath(existing.uploaded_file_path);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      uploadedFilePath = storedName;
    }

    try {
      const row = await this.queryOne(`
        UPDATE policy_documents
        SET
          document_code = $1,
          document_title = $2,
          department = $3,
          description = $4,
          version_no = $5,
          issue_date = $6,
          effective_date = $7,
          review_date = $8,
          expiry_date = $9,
          uploaded_file_path = $10,
          uploaded_by = COALESCE($11, uploaded_by),
          approved_by = $12,
          approved_date = $13,
          certified_authority = $14,
          certified_date = $15,
          certification_remarks = $16,
          user_access = $17,
          is_active = $18,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $19
        RETURNING *
      `, [
        docCode.trim().toUpperCase(),
        data.document_title ?? existing.document_title,
        data.department !== undefined ? data.department : existing.department,
        data.description !== undefined ? data.description : existing.description,
        data.version_no ?? existing.version_no,
        data.issue_date ? new Date(data.issue_date) : (data.issue_date === null ? null : existing.issue_date),
        data.effective_date ? new Date(data.effective_date) : (data.effective_date === null ? null : existing.effective_date),
        data.review_date ? new Date(data.review_date) : (data.review_date === null ? null : existing.review_date),
        data.expiry_date ? new Date(data.expiry_date) : (data.expiry_date === null ? null : existing.expiry_date),
        uploadedFilePath,
        data.uploaded_by ?? null,
        data.approved_by !== undefined ? data.approved_by : existing.approved_by,
        data.approved_date ? new Date(data.approved_date) : (data.approved_date === null ? null : existing.approved_date),
        data.certified_authority !== undefined ? data.certified_authority : existing.certified_authority,
        data.certified_date ? new Date(data.certified_date) : (data.certified_date === null ? null : existing.certified_date),
        data.certification_remarks !== undefined ? data.certification_remarks : existing.certification_remarks,
        data.user_access ?? existing.user_access,
        data.is_active ?? existing.is_active,
        id,
      ]);

      return row;
    } catch (error) {
      if (file && uploadedFilePath !== existing.uploaded_file_path) {
        const pathToDelete = this.getStoragePath(uploadedFilePath);
        if (fs.existsSync(pathToDelete)) {
          fs.unlinkSync(pathToDelete);
        }
      }
      throw error;
    }
  }

  async toggleStatus(id: number) {
    await this.findOne(id);
    return this.queryOne(`
      UPDATE policy_documents
      SET 
        is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [id]);
  }

  async remove(id: number) {
    const existing = await this.findOne(id);

    // Soft delete
    await this.db.query(`
      UPDATE policy_documents
      SET 
        deleted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

    // Optional: Delete physical file to save space, but soft delete keeps data.
    // In many applications, we retain files. We'll retain it for data integrity unless specified.
    return { success: true };
  }

  async getFileDetails(id: number) {
    const existing = await this.findOne(id);
    if (!existing.uploaded_file_path) {
      throw new NotFoundException('No file uploaded for this policy document');
    }

    const filePath = this.getStoragePath(existing.uploaded_file_path);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Physical file not found on server');
    }

    // Determine mimetype
    let mimetype = 'application/octet-stream';
    const ext = path.extname(existing.uploaded_file_path).toLowerCase();
    if (ext === '.pdf') mimetype = 'application/pdf';
    else if (ext === '.doc') mimetype = 'application/msword';
    else if (ext === '.docx') mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === '.png') mimetype = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimetype = 'image/jpeg';

    return {
      path: filePath,
      mimetype,
      filename: `${existing.document_code}_${existing.document_title}${ext}`.replace(/["\r\n]/g, '_'),
    };
  }
}
