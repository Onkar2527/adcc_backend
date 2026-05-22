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
import { BorderAreaMasterModule } from './modules/border-area-master/border-arear-master.module';
import { ManageAssementMasterModule } from './modules/manage-assement-master/manage-assement-master.module';
import { AuditCategoriesModule } from './modules/audit-category-master/audit-categories.module';
import { AuditAnnexureModule } from './modules/audit-annexure-master/audit-annexure.module';
import { RiskCategoryModule } from './modules/risk-masters/risk-category/risk-category.module';
import { RiskControlModule } from './modules/risk-masters/risk-control/risk-control.module';
import { RiskCompositeModule } from './modules/risk-masters/risk-composite/risk-composite.module';
import { RiskMatrixModule } from './modules/risk-masters/risk-matrix/risk-matrix.module';
import { BranchRatingModule } from './modules/risk-masters/risk-branch-rating/risk-branch-rating.module';
import { PeriodwiseQuestionsMasterModule } from './modules/periodwise-questions-master/periodwise-questions-master.module';
import { AuditDashboardModule } from './modules/auditor/audit-dashboard/audit-dashboard.module';
import { InternalAuditModule } from './modules/auditor/internal-audit/internal-audit.module';
import { DepositAccountsModule } from './modules/manage-accounts/deposit-accounts/deposit-accounts.module';
import { AdvanceAccountsModule } from './modules/manage-accounts/advance-accounts/advance-accounts.module';


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
    AuditQuestionsModule,
    BorderAreaMasterModule,
    ManageAssementMasterModule,
    AuditCategoriesModule,
    AuditAnnexureModule,
    RiskCategoryModule,
    RiskControlModule,
    RiskCompositeModule,
    RiskMatrixModule,
    BranchRatingModule,
    PeriodwiseQuestionsMasterModule,
    AuditDashboardModule,
    InternalAuditModule,
    DepositAccountsModule,
    AdvanceAccountsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
