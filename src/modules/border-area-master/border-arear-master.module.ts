import { Module } from "@nestjs/common";
import { BorderAreaMasterService } from ".//border-arear-master.service";
import { BorderAreaMastersController } from "./border-arear-master.controller";

@Module({
    controllers: [BorderAreaMastersController],
    providers: [BorderAreaMasterService],
})

export class BorderAreaMasterModule { }