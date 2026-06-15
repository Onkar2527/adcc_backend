import { Controller, Get, Put, Post, Param, Body, Req, Delete, Query } from "@nestjs/common";
import { ManageAssementMasterDto } from "./dto/manage-assement.dto";
import { ManageAssementMasterService } from "./manage-assement-master.service";

@Controller('manage-assessment-masters')

export class ManageAssementMastersController {
    constructor(private readonly service: ManageAssementMasterService) { }

    @Get()
    findAll(
        @Query('assesment_period_from') assesment_period_from: string,
        @Query('assesment_period_to') assesment_period_to: string,
        @Query('audit_unit_id') audit_unit_id: number
    ) {
        return this.service.findAll(
            assesment_period_from,
            assesment_period_to,
            audit_unit_id
        );
    }


    @Put(':id')
    update(@Param('id') id: string, @Body() dto: ManageAssementMasterDto) {
        return this.service.update(Number(id), dto)
    }

    @Get(':id/eligible-auditors')
    getEligibleAuditors(@Param('id') id: string) {
        return this.service.getEligibleAuditors(Number(id));
    }

    @Get(':id/question-assignments')
    getQuestionAssignments(@Param('id') id: string) {
        return this.service.getQuestionAssignments(Number(id));
    }

    @Get(':id/questions')
    getQuestions(@Param('id') id: string) {
        return this.service.getQuestions(Number(id));
    }

    @Post(':id/assign-questions')
    assignQuestions(
        @Param('id') id: string,
        @Body('assignments') assignments: { question_id: number; audit_emp_id: number }[]
    ) {
        return this.service.assignQuestions(Number(id), assignments);
    }
}