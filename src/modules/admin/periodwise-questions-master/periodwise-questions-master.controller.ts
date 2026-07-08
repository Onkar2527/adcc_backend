import { Controller, Get, Put, Post, Param, Body, Req, Delete } from "@nestjs/common";
import { PeriodwiseQuestionsMasterService } from "./periodwise-questions-master.service";
import { CreateMultiLevelControlMasterDto } from "./dto/periodwise-questions-master.dto";

@Controller('periodwise-questions-masters')
export class PeriodwiseQuestionsMastersController {
    constructor(private readonly service: PeriodwiseQuestionsMasterService) { }

    @Get()
    getAll() {
        return this.service.findAll();
    }
    @Get(':id')
    getQuestionData(@Param('id') id: string) {
        return this.service.findQuestionData(Number(id));
    }
    @Post()
    create(@Body() dto: CreateMultiLevelControlMasterDto, @Req() req) {
        const admin_id = req.user?.id || 1;
        return this.service.create({ ...dto, admin_id });
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() dto: CreateMultiLevelControlMasterDto) {
        return this.service.update(Number(id), dto)
    }


    @Put('advances-schemes/:id')
    updateAdvancesSchemes(@Param('id') id: string, @Body() dto: { advances_scheme_ids: string }) {
        return this.service.updateAdvaneSchemes(Number(id), dto)
    }
   
    @Put('deposit-schemes/:id')
    updateDepositSchemes(@Param('id') id: string, @Body() dto: { deposits_scheme_ids: string }) {
        return this.service.updateDepositSchemes(Number(id), dto)
    }

   
    @Put('menu/:id')
    updateMenu(@Param('id') id: string, @Body() dto: { menu_ids: string }) {
        return this.service.updateMenu(Number(id), dto)
    }

    @Put('multiple-auditors/:id')
    updateMultipleAuditors(@Param('id') id: string, @Body() dto: { is_multiple_auditors: boolean }) {
        return this.service.updateMultipleAuditors(Number(id), dto)
    }

    @Put('category/:id')
    updateCategory(@Param('id') id: string, @Body() dto: { cat_ids: string }) {
        return this.service.updateCategory(Number(id), dto)
    }
    
    @Put('question-and-headers/:id')
    updateQuestionAndHeaders(@Param('id') id: string, @Body() dto: { header_ids: string, question_ids: string }) {
        return this.service.updateQuestionAndHeaders(Number(id), dto)
    }

    @Get(':id/eligible-auditors')
    getEligibleAuditors(@Param('id') id: string) {
        return this.service.getEligibleAuditors(Number(id));
    }

    @Get(':id/category-assignments')
    getCategoryAssignments(@Param('id') id: string) {
        return this.service.getCategoryAssignments(Number(id));
    }

    @Post(':id/assign-categories')
    assignCategories(
        @Param('id') id: string,
        @Body() body: { assignments: { category_id: number; audit_emp_id: number }[] }
    ) {
        return this.service.assignCategories(Number(id), body.assignments);
    }

    @Post(':id/sync-all-branches')
    syncAllBranches(@Param('id') id: string) {
        return this.service.syncAllBranches(Number(id));
    }

    @Post(':id/sync-all-branches-current-assessment')
    syncAllBranchesCurrentAssessment(@Param('id') id: string) {
        return this.service.syncAllBranchesCurrentAssessment(Number(id));
    }

    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.service.softDelete(Number(id))
    }
}