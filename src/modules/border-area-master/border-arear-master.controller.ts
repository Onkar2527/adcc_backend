import { Controller, Get, Put, Post, Param, Body, Req, Delete } from "@nestjs/common";
import { BorderAreaMasterService } from "./border-arear-master.service";
import { CreateBorderAreaMasterDto } from "./dto/border-arear-master.dto";

@Controller('border-area-masters')

export class BorderAreaMastersController {
    constructor(private readonly service: BorderAreaMasterService) { }

    @Get()
    getAll() {
        return this.service.findAll();
    }
    

    @Post()
    create(@Body() dto: CreateBorderAreaMasterDto,  @Req() req) {
        const admin_id = req.user?.id || 1;
        return this.service.create({ ...dto, admin_id });
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() dto: CreateBorderAreaMasterDto) {
        return this.service.update(Number(id), dto.name, dto.appetite_percent, dto.occurance_percent, dto.magnitude, dto.frequency, dto.average_qualitative_count, dto.average_quantitative_count)
    }


    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.service.softDelete(Number(id))
    }
}