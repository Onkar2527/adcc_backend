import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ParticipantsService } from './participants.service';

@Controller('participants')
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Get()
  async findAll(@Query('proposalId') proposalId: string) {
    const data = await this.participantsService.findAllByProposal(proposalId);
    return { data };
  }

  @Get('proposal/:proposalId')
  async findByProposal(@Param('proposalId') proposalId: string) {
    const data = await this.participantsService.findAllByProposal(proposalId);
    return { data };
  }

  @Post()
  async create(@Body() data: { proposal_id: string; [key: string]: any }) {
    const { proposal_id, ...rest } = data;
    const result = await this.participantsService.create(proposal_id, rest);
    return { data: result, message: 'Participant created successfully' };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    const result = await this.participantsService.update(id, data);
    return { data: result, message: 'Participant updated successfully' };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.participantsService.remove(id);
    return { message: 'Participant removed successfully' };
  }
}
