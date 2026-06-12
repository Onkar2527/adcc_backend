import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { PolicyDocumentsService } from './policy-documents.service';
import { CreatePolicyDocumentDto, UpdatePolicyDocumentDto } from './dto/policy-document.dto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import * as fs from 'fs';

@Controller('policy-documents')
export class PolicyDocumentsController {
  constructor(private readonly service: PolicyDocumentsService) {}

  private async parseRequest(req: FastifyRequest) {
    const contentType = req.headers['content-type'] || '';
    const isMultipart = contentType.includes('multipart/form-data');

    if (isMultipart) {
      const part = await req.file();
      if (!part) {
        return { fields: {}, file: undefined };
      }

      const fields: any = {};
      for (const key in part.fields) {
        fields[key] = (part.fields as any)[key]?.value;
      }

      // Numeric conversions for database types
      if (fields.uploaded_by !== undefined && fields.uploaded_by !== '') {
        fields.uploaded_by = Number(fields.uploaded_by);
      }
      if (fields.is_active !== undefined && fields.is_active !== '') {
        fields.is_active = Number(fields.is_active);
      }

      return {
        fields,
        file: {
          filename: part.filename,
          mimetype: part.mimetype,
          buffer: await part.toBuffer(),
        },
      };
    } else {
      const body = (req.body as any) || {};
      if (body.uploaded_by !== undefined) {
        body.uploaded_by = Number(body.uploaded_by);
      }
      if (body.is_active !== undefined) {
        body.is_active = Number(body.is_active);
      }
      return {
        fields: body,
        file: undefined,
      };
    }
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('next-code')
  async getNextCode() {
    const code = await this.service.generateNextDocumentCode();
    return { success: true, code };
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  async create(@Req() req: FastifyRequest) {
    const { fields, file } = await this.parseRequest(req);
    const dto = fields as CreatePolicyDocumentDto;
    const result = await this.service.create(dto, file);
    return { success: true, data: result };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: FastifyRequest,
  ) {
    const { fields, file } = await this.parseRequest(req);
    const dto = fields as UpdatePolicyDocumentDto;
    const result = await this.service.update(id, dto, file);
    return { success: true, data: result };
  }

  @Patch(':id/status')
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    const result = await this.service.toggleStatus(id);
    return { success: true, data: result };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.service.remove(id);
    return { success: true, data: result };
  }

  @Get(':id/view')
  async viewFile(
    @Param('id', ParseIntPipe) id: number,
    @Res() reply: FastifyReply,
  ) {
    const fileDetails = await this.service.getFileDetails(id);

    reply.header('Content-Type', fileDetails.mimetype);
    reply.header(
      'Content-Disposition',
      `inline; filename="${fileDetails.filename}"`,
    );

    return reply.send(fs.createReadStream(fileDetails.path));
  }
}
