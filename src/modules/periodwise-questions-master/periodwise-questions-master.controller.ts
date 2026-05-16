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

    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.service.softDelete(Number(id))
    }
}