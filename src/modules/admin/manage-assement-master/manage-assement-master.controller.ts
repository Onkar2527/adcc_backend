import { Controller, Get, Put, Post, Param, Body, Req, Delete, Query } from "@nestjs/common";
import { ManageAssementMasterDto } from "./dto/manage-assement.dto";
import { ManageAssementMasterService } from "./manage-assement-master.service";

@Controller('manage-assessment-masters')

export class ManageAssementMastersController {
    constructor(private readonly service: ManageAssementMasterService) { }

    @Get()
    findAll(
        @Query('year_id') year_id: string,
        @Query('audit_unit_id') audit_unit_id: string
    ) {
        return this.service.findAll(
            Number(year_id || 0),
            Number(audit_unit_id || 0)
        );
    }

    @Get('years')
    getYears() {
        return this.service.getYears();
    }

    @Post('bulk-update-dates')
    bulkUpdateDates(
        @Body() body: { ids: number[]; audit_due_date?: string; compliance_due_date?: string }
    ) {
        return this.service.bulkUpdateDates(
            body.ids,
            body.audit_due_date,
            body.compliance_due_date
        );
    }


    @Put(':id')
    update(
        @Param('id') id: string,
        @Body() dto: ManageAssementMasterDto,
        @Req() req: any
    ) {
        const adminId = req.user?.id || 1;
        return this.service.update(Number(id), dto, adminId)
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