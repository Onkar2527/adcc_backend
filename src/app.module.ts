import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './core/database/database.module';
import { IdModule } from './core/id/id.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { BranchesModule } from './modules/branches/branches.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { LoanTypesModule } from './modules/loan-types/loan-types.module';
import { ParticipantsModule } from './modules/participants/participants.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { EmployeesModule } from './modules/employee-master/employees.module';
import { PasswordPolicyModule } from './modules/password-policy/password-policy.module';
import { UnitsModule } from './modules/units/units.module';
import { AuditSectionsModule } from './modules/audit-section-master/audit-sections.module';
import { MenuMasterModule } from './modules/menu-master/menu-master.module';
import { AuditUnitsModule } from './modules/audit-unit-master/audit-units.module';
import { AuditSchemesModule } from './modules/audit-scheme-master/audit-schemes.module';
import { AuditQuestionsModule } from './modules/audit-question-master/audit-questions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    IdModule,
    ProposalsModule,
    BranchesModule,
    RolesModule,
    UsersModule,
    AuthModule,
    LoanTypesModule,
    ParticipantsModule,
    DocumentsModule,
    EmployeesModule,
    PasswordPolicyModule,
    UnitsModule,
    AuditSectionsModule,
    MenuMasterModule,
    AuditUnitsModule,
    AuditSchemesModule,
    AuditQuestionsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
